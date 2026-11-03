import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { getCase } from '../caseService.js';
import Claim from '../../models/Claim.js';
import ClaimConflict from '../../models/ClaimConflict.js';
import Evidence from '../../models/Evidence.js';
import { ApiError } from '../../utils/ApiError.js';
import { verifyClaim } from './claimVerifier.js';
import { findPotentialConflicts } from './conflictDetector.js';
import { assertCanAccessLevel, filterByPermission, inheritAccessLevel } from '../permissions/permissionService.js';
function validateId(id, label) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label} ID`, `INVALID_${label.toUpperCase()}_ID`);
}
function normalizeEvidenceIds(ids = []) { return [...new Set(ids.map(String))]; }
function effectiveAccessLevel(requested, evidence) {
  return evidence.reduce((level, record) => accessRank[record.accessLevel] > accessRank[level] ? record.accessLevel : level, requested ?? 'team');
}

async function prepareClaim(caseId, input, role) {
  const evidenceIds = normalizeEvidenceIds(input.evidenceIds);
  const citationIds = new Set((input.citations ?? []).map((citation) => String(citation.evidenceId)));
  const ids = [...new Set([...evidenceIds, ...citationIds])];
  const evidence = ids.length ? await Evidence.find({ _id: { $in: ids } }).lean() : [];
  const otherCaseEvidence = evidence.find((record) => String(record.caseId) !== String(caseId));
  if (otherCaseEvidence) throw new ApiError(400, 'Evidence must belong to the same case as the claim', 'CROSS_CASE_EVIDENCE');
  for (const record of evidence) assertCanAccessLevel(role, record.accessLevel);
  const verified = await verifyClaim({ ...input, evidenceIds, citations: input.citations ?? [] }, evidence);
  return {
    evidenceIds,
    citations: (input.citations ?? []).map((citation) => ({ evidenceId: citation.evidenceId, quote: citation.quote })),
    evidence,
    status: verified.status,
    verification: verified.verification,
    accessLevel: inheritAccessLevel(input.accessLevel, evidence)
  };
}

async function markConflicts(claim) {
  const existing = await Claim.find({ caseId: claim.caseId, _id: { $ne: claim._id }, supersededBy: null }).lean();
  const candidates = findPotentialConflicts(claim, existing);
  for (const candidate of candidates) {
    const claimIds = [String(claim._id), String(candidate.claim._id)].sort();
    const fingerprint = createHash('sha256').update(`${claim.caseId}:${claimIds.join(':')}:${candidate.entityKey}`).digest('hex');
    let conflict;
    try {
      conflict = await ClaimConflict.findOneAndUpdate({ fingerprint }, {
        $setOnInsert: {
          caseId: claim.caseId,
          claimIds: claimIds.map((id) => new mongoose.Types.ObjectId(id)),
          entityKey: candidate.entityKey,
          claimValues: [
            { claimId: candidate.claim._id, value: candidate.existingValue },
            { claimId: claim._id, value: candidate.newValue }
          ],
          reason: `Claims state different values for ${candidate.entityKey}; this is a potential conflict requiring review.`,
          fingerprint
        }
      }, { upsert: true, returnDocument: 'after' });
    } catch (error) {
      if (error.code !== 11000) throw error;
      conflict = await ClaimConflict.findOne({ fingerprint });
    }
    await Claim.updateMany({ _id: { $in: claimIds } }, { $set: { status: 'conflicting' }, $addToSet: { conflictIds: conflict._id } });
  }
}

async function ownedClaim(id, userId, role) {
  validateId(id, 'claim');
  const claim = await Claim.findById(id).lean();
  if (!claim) throw new ApiError(404, 'Claim not found', 'CLAIM_NOT_FOUND');
  try { await getCase(claim.caseId, userId, role); } catch { throw new ApiError(404, 'Claim not found', 'CLAIM_NOT_FOUND'); }
  assertCanAccessLevel(role, claim.accessLevel);
  return claim;
}

export async function createClaim(caseId, userId, role, input) {
  validateId(caseId, 'case');
  await getCase(caseId, userId, role);
  const prepared = await prepareClaim(caseId, input, role);
  assertCanAccessLevel(role, prepared.accessLevel);
  const claim = await Claim.create({
    caseId, text: input.text, claimType: input.claimType,
    evidenceIds: prepared.evidenceIds, citations: prepared.citations,
    status: prepared.status, verification: prepared.verification,
    accessLevel: prepared.accessLevel, createdBy: userId
  });
  await markConflicts(claim.toObject());
  return Claim.findById(claim._id).lean();
}

export async function listClaims(caseId, userId, role) {
  validateId(caseId, 'case');
  await getCase(caseId, userId, role);
  const claims = await Claim.find({ caseId, supersededBy: null }).sort({ createdAt: -1 }).lean();
  return filterByPermission(claims, role);
}

export async function getClaim(id, userId, role) {
  return ownedClaim(id, userId, role);
}

export async function getClaimConflicts(id, userId, role) {
  const claim = await ownedClaim(id, userId, role);
  if (!claim.conflictIds.length) return [];
  return ClaimConflict.find({ _id: { $in: claim.conflictIds }, caseId: claim.caseId }).sort({ createdAt: 1 }).lean();
}

export async function updateClaim(id, userId, role, changes) {
  const previous = await ownedClaim(id, userId, role);
  if (previous.supersededBy) throw new ApiError(409, 'Claim version has been superseded', 'CLAIM_VERSION_SUPERSEDED');
  let evidenceIds = changes.evidenceIds ?? previous.evidenceIds.map(String);
  let citations = changes.citations ?? previous.citations.map((citation) => ({ evidenceId: String(citation.evidenceId), quote: citation.quote }));
  if (changes.evidenceIds && !changes.citations) {
    const retained = new Set(evidenceIds.map(String));
    citations = citations.filter((citation) => retained.has(String(citation.evidenceId)));
  }
  if (changes.citations && !changes.evidenceIds) evidenceIds = [...new Set(citations.map((citation) => String(citation.evidenceId)))];
  const input = {
    text: changes.text ?? previous.text,
    claimType: changes.claimType ?? previous.claimType,
    evidenceIds,
    citations,
    accessLevel: changes.accessLevel ?? previous.accessLevel
  };
  const prepared = await prepareClaim(previous.caseId, input, role);
  assertCanAccessLevel(role, prepared.accessLevel);
  const next = await Claim.create({
    caseId: previous.caseId, text: input.text, claimType: input.claimType,
    evidenceIds: prepared.evidenceIds, citations: prepared.citations,
    status: prepared.status, reviewStatus: 'pending', verification: prepared.verification,
    accessLevel: prepared.accessLevel, createdBy: userId, version: previous.version + 1,
    previousVersion: previous._id
  });
  await Claim.updateOne({ _id: previous._id, supersededBy: null }, { $set: { supersededBy: next._id } });
  await markConflicts(next.toObject());
  return Claim.findById(next._id).lean();
}
