const objectIdPattern = /^[a-f\d]{24}$/i;

const categoryRules = [
  {
    claimType: 'unfinished_work',
    pattern: /\b(?:TODO|FIXME|unfinished|incomplete|not yet implemented|not implemented yet|still not implemented|work in progress|in progress|pending|unresolved|blocked|remains to be done|still needs? to be done|not completed)\b/i
  },
  {
    claimType: 'ownership',
    pattern: /\b(?:owned by|owner\s*(?:is|:)|assignee\s*(?:is|:)|assigned to|responsible for|maintained by|maintainer\s*(?:is|:)|accountable for)\b/i
  },
  {
    claimType: 'commitment',
    pattern: /\b(?:(?:we|i|the team)\s+(?:will|promise to|committed to|agreed to)|will deliver|will complete|will implement|deadline|due by|committed by)\b/i
  },
  {
    claimType: 'technical_decision',
    pattern: /\b(?:decision|decided to|chose to|chosen because|selected because|selected to|adopted because|architecture decision|we chose|we selected|we use .+ because|using .+ because|because .{5,})\b/i
  },
  {
    claimType: 'dependency',
    pattern: /\b(?:depends on|dependency|dependencies|requires? (?:the )?(?:service|database|package|library|runtime|platform|api)|integrates with|connects to|built on|powered by)\b/i
  },
  {
    claimType: 'configuration',
    pattern: /(?:\b(?:configured|configuration|environment|deployment environment|runtime version|framework version|database version|runs on|deployed to)\b|\b(?:Node\.js|React|Next\.js|Express|MongoDB|PostgreSQL|MySQL|Redis|SQLite|Docker|Kubernetes|AWS|GCP|Azure|Python|Java|TypeScript|JavaScript|Go|Rust|FastAPI|Django|Spring|GraphQL|Kafka|RabbitMQ|Prisma|Mongoose|Vite|Vitest|Jest)\b(?:\s+(?:v|version\s*)?\d+(?:\.\d+){0,3})?)/i
  },
  {
    claimType: 'risk',
    pattern: /\b(?:risk|blocker|blocked by|vulnerabilit(?:y|ies)|security issue|at risk|could cause|may cause|can cause|could result in|may result in|failure mode|data loss|duplicate charges|duplicate submissions)\b/i
  },
  {
    claimType: 'general',
    pattern: /\b(?:is|are|provides|supports|stores|contains|serves|maintains|hosts|runs|records|uses)\b/i
  }
];

function splitEvidenceText(text) {
  const segments = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^```/.test(trimmed) || /^\|?\s*:?-{3,}/.test(trimmed)) continue;

    // Keep each segment as a substring of the source so it is directly citable.
    const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9`*_#])/u);
    for (const sentence of sentences) {
      const quote = sentence.trim();
      if (quote) segments.push(quote);
    }
  }
  return segments;
}

function statementFromQuote(quote) {
  return quote
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/^\s*[-*+]\s*/, '')
    .trim();
}

function normalizedText(value) {
  return String(value).toLowerCase().replace(/[^a-z\d]+/g, ' ').trim();
}

function exactQuote(record, quote) {
  return typeof record?.text === 'string'
    && typeof quote === 'string'
    && quote.length > 0
    && record.text.includes(quote);
}

function classify(segment) {
  for (const rule of categoryRules) {
    if (rule.pattern.test(segment)) return rule.claimType;
  }
  return null;
}

function isMeaningful(claimText, claimType) {
  if (claimText.length < 20 || claimText.length > 5000) return false;
  const words = claimText.match(/[\p{L}\d][\p{L}\d._/-]*/gu) ?? [];
  if (words.length < 4) return false;
  if (claimType === 'general' && words.length < 8) return false;
  return true;
}

export function generateDeterministicClaims(evidence) {
  const candidates = new Map();
  let rejectedCount = 0;
  let qualityRejectedCount = 0;
  let candidateCount = 0;
  let duplicatesRemoved = 0;

  for (const record of evidence ?? []) {
    const evidenceId = String(record?._id ?? '');
    if (!objectIdPattern.test(evidenceId) || typeof record?.text !== 'string') continue;

    let generalClaimAdded = false;
    let evidenceClaimCount = 0;
    for (const quote of splitEvidenceText(record.text)) {
      const claimText = statementFromQuote(quote);
      const claimType = classify(claimText);
      if (!claimType || (claimType === 'general' && generalClaimAdded)) continue;
      candidateCount += 1;
      if (!isMeaningful(claimText, claimType)) {
        qualityRejectedCount += 1;
        continue;
      }
      if (!exactQuote(record, quote)) {
        rejectedCount += 1;
        continue;
      }

      const key = `${claimType}|${normalizedText(claimText)}`;
      const citation = { evidenceId, quote };
      const existing = candidates.get(key);
      if (existing) {
        duplicatesRemoved += 1;
        if (!existing.supportingQuotes.some((item) => item.evidenceId === evidenceId && item.quote === quote)) {
          existing.supportingQuotes.push(citation);
        }
      } else {
        candidates.set(key, {
          claimText,
          claimType,
          supportingQuotes: [citation]
        });
      }

      if (claimType === 'general') generalClaimAdded = true;
      evidenceClaimCount += 1;
      if (evidenceClaimCount >= 12) break;
    }
  }

  const claims = [...candidates.values()].filter((candidate) => candidate.supportingQuotes.every((citation) => {
      const record = (evidence ?? []).find((item) => String(item?._id) === citation.evidenceId);
      return objectIdPattern.test(citation.evidenceId) && exactQuote(record, citation.quote);
    }));
  rejectedCount += candidates.size - claims.length;
  return { claims, candidateCount, rejectedCount, qualityRejectedCount, duplicatesRemoved };
}
