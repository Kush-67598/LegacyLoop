import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Case from '../../models/Case.js';
import Claim from '../../models/Claim.js';
import Evidence from '../../models/Evidence.js';
import Handover from '../../models/Handover.js';
import { ApiError } from '../../utils/ApiError.js';
import { filterByPermission } from '../permissions/permissionService.js';
import { validateCitations } from '../claims/citationValidator.js';

const handoverSections = [
  { key: 'project_overview', title: 'Project Overview', claimTypes: ['general'] },
  { key: 'module_ownership', title: 'Module Ownership', claimTypes: ['ownership'] },
  { key: 'work_in_progress', title: 'Work in Progress', claimTypes: ['unfinished_work'] },
  { key: 'technical_decisions', title: 'Technical Decisions', claimTypes: ['technical_decision', 'configuration'] },
  { key: 'dependencies', title: 'Dependencies', claimTypes: ['dependency'] },
  { key: 'risks', title: 'Risks', claimTypes: ['risk'] },
  { key: 'knowledge_gaps', title: 'Knowledge Gaps', claimTypes: [] },
  { key: 'first_week_priorities', title: 'First-Week Priorities', claimTypes: ['commitment'] },
  { key: 'unanswered_questions', title: 'Unanswered Questions', claimTypes: [] }
];
const handoverEligibleStatuses = new Set(['verified', 'inferred', 'leaver_stated', 'needs_ai_review']);

function claimBelongsToSection(claim, section) {
  if (section.key === 'knowledge_gaps') return ['general', 'risk'].includes(claim.claimType) && /knowledge gap|undocumented|not documented|no documentation|unknown|unclear|missing (?:context|documentation|knowledge)/i.test(claim.text);
  if (section.key === 'unanswered_questions') return ['general', 'commitment'].includes(claim.claimType) && (claim.text.trim().endsWith('?') || /^unanswered question:/i.test(claim.text));
  if (section.key === 'project_overview' && claim.claimType === 'general') return !claimBelongsToSection(claim, { key: 'knowledge_gaps' }) && !claimBelongsToSection(claim, { key: 'unanswered_questions' });
  return section.claimTypes.includes(claim.claimType);
}

function makeSections(claims, evidenceById, handoverCase) {
  return handoverSections.map((section) => {
    const items = claims.filter((claim) => claimBelongsToSection(claim, section)).map((claim) => ({
      id: String(claim._id),
      claimId: String(claim._id),
      text: claim.text,
      claimType: claim.claimType,
      version: claim.version,
      citations: claim.citations.map((citation) => {
        const record = evidenceById.get(String(citation.evidenceId));
        return { evidenceId: String(record._id), quote: citation.quote, sourceType: record.sourceType, sourceName: record.sourceName, locator: record.locator, author: record.author ?? null, timestamp: record.timestamp ?? null };
      })
    }));
    const missingInformation = items.length ? [] : [
      section.key === 'knowledge_gaps'
        ? 'No approved, permission-accessible claim documents a knowledge gap.'
        : section.key === 'unanswered_questions'
          ? 'No approved, permission-accessible claim records an unanswered question.'
          : `No approved, permission-accessible claims are available for ${section.title.toLowerCase()}.`
    ];
    const context = section.key === 'project_overview' ? {
      source: 'case_record', title: handoverCase.title, projectName: handoverCase.projectName,
      description: handoverCase.description, departingMember: handoverCase.departingMember, successor: handoverCase.successor
    } : undefined;
    return { key: section.key, title: section.title, ...(context ? { context } : {}), items, missingInformation };
  });
}

function successorMatches(handoverCase, user) {
  return user.role === 'successor' && String(handoverCase.successor).trim().toLowerCase() === String(user.demoIdentity).trim().toLowerCase();
}

async function loadPermittedCase(caseId, user) {
  if (!mongoose.isValidObjectId(caseId)) throw new ApiError(400, 'Invalid case ID', 'INVALID_CASE_ID');
  const handoverCase = await Case.findOne({ _id: caseId, archivedAt: null }).lean();
  if (!handoverCase) throw new ApiError(404, 'Case not found', 'CASE_NOT_FOUND');
  const member = user.role === 'admin'
    || String(handoverCase.createdBy) === user.id
    || (handoverCase.reviewerIds ?? []).some((id) => String(id) === user.id);
  if (!member && !successorMatches(handoverCase, user)) throw new ApiError(404, 'Case not found', 'CASE_NOT_FOUND');
  return handoverCase;
}

export async function generateHandover(caseId, user) {
  const handoverCase = await loadPermittedCase(caseId, user);
  const reviewable = await Claim.find({
    caseId,
    reviewStatus: 'approved',
    status: { $in: [...handoverEligibleStatuses] },
    supersededBy: null
  }).sort({ createdAt: 1 }).lean();
  const claimAccess = filterByPermission(reviewable, user.role);
  const allEvidenceIds = [...new Set(claimAccess.flatMap((claim) => claim.evidenceIds.map(String)))];
  const loadedEvidence = allEvidenceIds.length ? await Evidence.find({ caseId, _id: { $in: allEvidenceIds } }).lean() : [];
  const permittedEvidence = filterByPermission(loadedEvidence, user.role);
  const evidenceById = new Map(permittedEvidence.map((record) => [String(record._id), record]));
  const validClaims = claimAccess.filter((claim) => {
    const claimEvidence = claim.evidenceIds.map((id) => evidenceById.get(String(id)));
    if (claimEvidence.some((record) => !record)) return false;
    return validateCitations(claim, claimEvidence).valid;
  });
  const validEvidenceIds = [...new Set(validClaims.flatMap((claim) => claim.evidenceIds.map(String)))];
  const validEvidenceById = new Map(validEvidenceIds.map((id) => [id, evidenceById.get(id)]));
  const sections = makeSections(validClaims, validEvidenceById, handoverCase);
  const claimIds = validClaims.map((claim) => claim._id);
  const contentHash = createHash('sha256').update(JSON.stringify({
    case: { title: handoverCase.title, projectName: handoverCase.projectName, departingMember: handoverCase.departingMember, successor: handoverCase.successor },
    claimIds: claimIds.map(String), sections
  })).digest('hex');
  const latest = await Handover.findOne({ caseId, generatedFor: user.id, role: user.role }).sort({ version: -1 });
  if (latest?.contentHash === contentHash) return latest.toObject();
  return Handover.create({
    caseId,
    generatedFor: user.id,
    role: user.role,
    claimIds,
    sections,
    contentHash,
    version: (latest?.version ?? 0) + 1,
    status: 'published'
  }).then((handover) => handover.toObject());
}

export async function acknowledgeHandover(id, user, input) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid handover ID', 'INVALID_HANDOVER_ID');
  if (user.role !== 'successor') throw new ApiError(403, 'Only the successor can acknowledge a handover', 'SUCCESSOR_REQUIRED');
  const handover = await Handover.findOne({ _id: id, generatedFor: user.id, role: 'successor' });
  if (!handover) throw new ApiError(404, 'Handover not found', 'HANDOVER_NOT_FOUND');
  const handoverCase = await Case.findOne({ _id: handover.caseId, archivedAt: null }).lean();
  if (!handoverCase || !successorMatches(handoverCase, user)) throw new ApiError(404, 'Handover not found', 'HANDOVER_NOT_FOUND');
  const allItems = handover.sections.flatMap((section) => section.items);
  const item = allItems.find(({ id: itemId }) => itemId === input.itemId);
  if (!item) throw new ApiError(404, 'Handover item not found', 'HANDOVER_ITEM_NOT_FOUND');
  handover.acknowledgements.push({ itemId: item.id, claimId: item.claimId, actorId: user.id, action: input.action, comment: input.comment });
  const latestAction = new Map();
  for (const entry of handover.acknowledgements) latestAction.set(entry.itemId, entry.action);
  const hasFollowUp = [...latestAction.values()].some((action) => action !== 'acknowledge');
  const allAcknowledged = allItems.length > 0 && allItems.every(({ id: itemId }) => latestAction.get(itemId) === 'acknowledge');
  handover.status = hasFollowUp ? 'needs_revision' : allAcknowledged ? 'acknowledged' : 'published';
  handover.acknowledgedAt = allAcknowledged && !hasFollowUp ? new Date() : null;
  await handover.save();
  return handover.toObject();
}
