import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

import Claim from '../../models/Claim.js';
import Evidence from '../../models/Evidence.js';
import { ApiError } from '../../utils/ApiError.js';

import { generateAnalysis } from '../analysis/analysisService.js';
import { getCase } from '../caseService.js';

import {
  filterByPermission,
  inheritAccessLevel
} from '../permissions/permissionService.js';

import {
  redactEvidence,
  redactText
} from '../evidence/redactor.js';

import { validateCitations } from './citationValidator.js';
import { generateStructuredClaims } from './llmClaimProvider.js';
import { generateDeterministicClaims } from './deterministicClaimProvider.js';
const BATCH_SIZE = 2;
const MAX_PROMPT_TEXT = 6_000;

const inFlightByCase = new Map();

const claimTypes = new Set([
  'ownership',
  'technical_decision',
  'unfinished_work',
  'dependency',
  'risk',
  'commitment',
  'configuration',
  'general'
]);

const priorityMetadataKeys = [
  'environment',
  'env',
  'configVersion',
  'version',
  'branch',
  'status',
  'state',
  'assignee',
  'merged',
  'changedFiles',
  'insertions',
  'deletions'
];

function normalizeQuote(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedClaimText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z\d]+/g, ' ')
    .trim();
}

function compactMetadata(value, depth = 0) {
  if (typeof value === 'string') {
    return value.slice(0, 1000);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map((item) => compactMetadata(item, depth + 1));
  }

  if (!value || typeof value !== 'object' || depth >= 4) {
    return value;
  }

  const entries = Object.entries(value)
    .sort(([left], [right]) => {
      const leftPriority = priorityMetadataKeys.indexOf(left);
      const rightPriority = priorityMetadataKeys.indexOf(right);

      return (
        (leftPriority < 0 ? 100 : leftPriority) -
        (rightPriority < 0 ? 100 : rightPriority)
      );
    })
    .slice(0, 40);

  return Object.fromEntries(
    entries.map(([key, child]) => [
      key,
      compactMetadata(child, depth + 1)
    ])
  );
}

function keyForClaim(claimType, citations) {
  const source = citations
    .map((citation) =>
      `${String(citation.evidenceId)}:${normalizeQuote(citation.quote).toLowerCase()}`
    )
    .sort()
    .join('|');

  return createHash('sha256')
    .update(`${claimType}|${source}`)
    .digest('hex');
}

function citationKey(citation) {
  return `${String(citation.evidenceId)}:${normalizeQuote(citation.quote).toLowerCase()}`;
}

async function mergeDuplicateEvidence(existing, candidate, evidenceById) {
  const existingCitationKeys = new Set((existing.citations ?? []).map(citationKey));
  const newCitations = candidate.citations.filter((citation) => !existingCitationKeys.has(citationKey(citation)));
  if (!newCitations.length) return;

  const evidenceIds = [...new Set([...(existing.evidenceIds ?? []).map(String), ...newCitations.map((citation) => String(citation.evidenceId))])];
  const citedEvidence = evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean);
  const accessLevel = inheritAccessLevel(existing.accessLevel ?? 'team', citedEvidence);
  const update = await Claim.updateOne({ _id: existing._id }, {
    $addToSet: {
      evidenceIds: { $each: newCitations.map((citation) => citation.evidenceId) },
      citations: { $each: newCitations }
    },
    $set: { accessLevel }
  });
  if (!update.matchedCount) throw new ApiError(500, 'A duplicate claim changed while its evidence references were being merged.', 'CLAIM_EVIDENCE_MERGE_FAILED');

  existing.evidenceIds = evidenceIds;
  existing.citations = [...(existing.citations ?? []), ...newCitations];
  existing.accessLevel = accessLevel;
}

function evidenceForPrompt(record) {
  const safe = redactEvidence(record).record;

  return {
    evidenceId: String(record._id),
    sourceType: safe.sourceType,
    sourceName: safe.sourceName,
    locator: safe.locator,
    text: safe.text.slice(0, MAX_PROMPT_TEXT),
    textTruncated: safe.text.length > MAX_PROMPT_TEXT,
    author: safe.author,
    timestamp: safe.timestamp,
    metadata: compactMetadata(safe.metadata),
    accessLevel: record.accessLevel
  };
}

function validateGeneratedClaim(candidate, batchEvidence, caseId) {
  if (!candidate || !claimTypes.has(candidate.claimType)) {
    return null;
  }

  const text = String(candidate.claimText ?? '').trim();

  if (text.length < 20 || text.length > 5000) {
    return null;
  }

  const citations = candidate.supportingQuotes;

  if (!Array.isArray(citations) || !citations.length) {
    return null;
  }

  const evidenceById = new Map(
    batchEvidence.map((record) => [
      String(record._id),
      record
    ])
  );

  const normalizedCitations = [];

  for (const citation of citations) {
    const evidenceId = String(citation?.evidenceId ?? '');
    const quote = String(citation?.quote ?? '').trim();

    const record = evidenceById.get(evidenceId);

    if (
      !record ||
      String(record.caseId) !== String(caseId) ||
      !quote
    ) {
      return null;
    }

    if (
      !normalizeQuote(record.text).includes(
        normalizeQuote(quote)
      )
    ) {
      return null;
    }

    normalizedCitations.push({
      evidenceId,
      quote
    });
  }

  const evidenceIds = [
    ...new Set(
      normalizedCitations.map(
        (citation) => citation.evidenceId
      )
    )
  ];

  const validation = validateCitations(
    {
      evidenceIds,
      citations: normalizedCitations
    },
    batchEvidence
  );

  if (!validation.valid) {
    return null;
  }

  const citedEvidence = evidenceIds.map(
    (id) => evidenceById.get(id)
  );

  return {
    text,
    claimType: candidate.claimType,
    evidenceIds,
    citations: normalizedCitations,
    citationCheck: validation,
    accessLevel: inheritAccessLevel(
      'team',
      citedEvidence
    ),
    confidence: Number.isFinite(candidate.confidence)
      ? candidate.confidence
      : null,
    generationKey: keyForClaim(
      candidate.claimType,
      normalizedCitations
    )
  };
}

function analysisContext(analysis) {
  return {
    ownership: analysis.ownership.map((module) => ({
      module: module.module,

      contributors: module.contributors.map(
        ({ name, commitCount, filesModified, lastActivity }) => ({
          name: redactText(name).text,
          commitCount,
          filesModified,
          lastActivity
        })
      ),

      riskSignals: module.riskSignals
    })),

    contributors: analysis.contributors.map((item) => ({
      ...item,
      module: redactText(item.module).text
    })),

    openWork: Object.fromEntries(
      Object.entries(analysis.openWork).map(([key, value]) => [
        key,

        Array.isArray(value)
          ? value.map((item) => ({
              ...item,

              title: item.title
                ? redactText(item.title).text
                : item.title,

              assignee: item.assignee
                ? redactText(item.assignee).text
                : item.assignee
            }))
          : value
      ])
    ),

    timeline: analysis.timeline.map((item) => ({
      ...item,
      event: redactText(item.event).text,

      author: item.author
        ? redactText(item.author).text
        : null
    }))
  };
}

async function generateBatchWithRetry(input) {
  // Transient retries are bounded in the provider. A 429 or any other final
  // provider error returns immediately so the caller can use local rules.
  return generateStructuredClaims(input);
}

// ============================================================
// MAIN CLAIM GENERATION
// ============================================================

async function runGeneration(caseId, userId, role) {
  if (!mongoose.isValidObjectId(caseId)) {
    throw new ApiError(
      400,
      'Invalid case ID',
      'INVALID_CASE_ID'
    );
  }

  const handoverCase = await getCase(
    caseId,
    userId,
    role
  );

  // Load accessible evidence.
  const allEvidence = await Evidence.find({ caseId })
    .sort({ timestamp: 1, createdAt: 1 })
    .lean();

  const evidence = filterByPermission(
    allEvidence,
    role
  );

  if (!evidence.length) {
    throw new ApiError(
      400,
      'Upload accessible evidence before generating claims.',
      'NO_ACCESSIBLE_EVIDENCE'
    );
  }

  // Generate analysis using permitted evidence.
  const analysis = await generateAnalysis(caseId, {
    departingMember: handoverCase.departingMember,
    role
  });

  const project = {
    projectName: redactText(
      handoverCase.projectName
    ).text,

    title: redactText(
      handoverCase.title
    ).text,

    description: redactText(
      handoverCase.description || ''
    ).text
  };

  const context = analysisContext(analysis);

  // Load existing claims before processing batches.
  const existingClaims = await Claim.find({ caseId })
    .select('_id text claimType generationKey evidenceIds citations verification accessLevel')
    .lean();

  const knownKeys = new Set(
    existingClaims
      .map((claim) => claim.generationKey)
      .filter(Boolean)
  );

  const knownText = new Set(
    existingClaims.map((claim) =>
      normalizedClaimText(claim.text)
    )
  );
  const knownClaimByText = new Map();
  for (const claim of existingClaims) {
    const key = normalizedClaimText(claim.text);
    if (!knownClaimByText.has(key)) knownClaimByText.set(key, claim);
  }
  const evidenceById = new Map(evidence.map((record) => [String(record._id), record]));

  const savedClaims = [];
  const generationMethods = new Set();

  let skippedCount = 0;

  // Process batches sequentially and save each batch immediately.
  for (
    let offset = 0;
    offset < evidence.length;
    offset += BATCH_SIZE
  ) {
    const batch = evidence.slice(
      offset,
      offset + BATCH_SIZE
    );

    let generated;
    let generationMethod;

    try {
      generated = await generateBatchWithRetry({
        project,
        analysis: context,
        evidence: batch.map(evidenceForPrompt)
      });
      generationMethod = 'AI_GENERATED';
    } catch (error) {
      generationMethod = 'RULE_BASED';
      if (error?.code === 'AI_RATE_LIMITED') {
        console.warn(error?.details?.quotaExhausted
          ? '[GEMINI] HTTP 429. Quota exhausted.'
          : '[GEMINI] HTTP 429. Rate limited.');
        console.warn('[CLAIMS] Switching immediately to deterministic generation.');
      } else {
        console.warn(`[CLAIMS] Gemini generation failed (${error?.code ?? 'provider error'}). Switching to deterministic claim generation.`);
      }
      console.log('[RULE ENGINE] Processing uploaded evidence.');
      let deterministic;
      try {
        deterministic = generateDeterministicClaims(batch);
      } catch (ruleError) {
        console.error('[RULE ENGINE] Deterministic extraction failed.', {
          code: ruleError?.code ?? 'RULE_ENGINE_ERROR',
          name: ruleError?.name ?? 'Error'
        });
        throw new ApiError(500, 'Deterministic claim extraction failed for stored evidence.', 'RULE_ENGINE_FAILED');
      }
      generated = deterministic.claims;
      console.log(`[RULE ENGINE] Extracted ${deterministic.candidateCount} candidate claims.`);
      console.log(`[RULE ENGINE] Rejected ${deterministic.rejectedCount} claims because supporting quotations could not be verified.`);
      console.log(`[RULE ENGINE] Discarded ${deterministic.qualityRejectedCount} candidates that did not meet the minimum claim-quality rules.`);
      console.log(`[RULE ENGINE] Removed ${deterministic.duplicatesRemoved} duplicate claims.`);
      console.log(`[RULE ENGINE] Generated ${generated.length} validated claims.`);
    }
    generationMethods.add(generationMethod);

    // Validate and save claims from this batch immediately.
    if (generated.length) console.log('[CLAIMS] Saving claims to MongoDB.');
    for (const candidate of generated) {
      const validated = validateGeneratedClaim(
        candidate,
        batch,
        caseId
      );

      if (!validated) {
        skippedCount += 1;
        continue;
      }

      const claim = validated;

      // Prevent duplicates against existing and newly saved claims.
      const textKey = normalizedClaimText(claim.text);
      if (knownKeys.has(claim.generationKey) || knownText.has(textKey)) {
        const duplicate = knownClaimByText.get(textKey);
        if (duplicate) await mergeDuplicateEvidence(duplicate, claim, evidenceById);
        skippedCount += 1;
        continue;
      }

      // Reserve the keys before attempting insertion.
      knownKeys.add(claim.generationKey);
      knownText.add(normalizedClaimText(claim.text));

      try {
        const saved = await Claim.create({
          caseId,

          text: claim.text,
          claimType: claim.claimType,

          evidenceIds: claim.evidenceIds,
          citations: claim.citations,

          status: 'pending',
          reviewStatus: 'pending',

          accessLevel: claim.accessLevel,
          confidence: claim.confidence,

          verification: {
            generation: {
              result: 'completed',
              generatedAt: new Date(),
              provider: generationMethod === 'AI_GENERATED' ? 'gemini' : 'rule_engine',
              method: generationMethod
            },

            citationCheck: {
              result: 'passed',
              valid: true,
              failures: [],
              checkedAt: new Date()
            },

            supportCheck: {
              result: 'not_run',
              reason: 'Claim generation is separate from support verification.'
            }
          },

          generationKey: claim.generationKey,
          createdBy: userId
        });

        const savedClaim = saved.toObject();
        savedClaims.push(savedClaim);
        knownClaimByText.set(textKey, savedClaim);
      } catch (error) {
        if (error.code === 11000) {
          skippedCount += 1;
          continue;
        }

        throw error;
      }
    }
  }

  const methods = [...generationMethods];
  const generationMethod = methods.length > 1 ? 'MIXED' : methods[0] ?? 'NONE';
  console.log(`[CLAIMS] Successfully saved ${savedClaims.length} claims using ${generationMethod} generation.`);

  return {
    generatedCount: savedClaims.length,
    skippedCount,
    claims: savedClaims,
    generationMethod,
    generationMethods: methods,
    partial: false,
    failedBatches: 0,
    message: savedClaims.length
      ? `${savedClaims.length} claims generated successfully using ${generationMethod} generation.`
      : 'Uploaded evidence did not support any new valid claims.'
  };
}

// ============================================================
// PUBLIC SERVICE FUNCTION
// ============================================================

export async function generateCaseClaims(
  caseId,
  userId,
  role
) {
  const key = String(caseId);

  const active = inFlightByCase.get(key);

  if (active) {
    const result = await active.promise;

    if (
      String(active.userId) === String(userId) &&
      active.role === role
    ) {
      return result;
    }

    return generateCaseClaims(
      caseId,
      userId,
      role
    );
  }

  const entry = {
    userId,
    role,
    promise: runGeneration(caseId, userId, role)
  };

  inFlightByCase.set(key, entry);

  try {
    return await entry.promise;
  } finally {
    if (inFlightByCase.get(key) === entry) {
      inFlightByCase.delete(key);
    }
  }
}
