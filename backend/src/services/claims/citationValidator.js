function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function validateCitations(claim, evidence) {
  const evidenceIds = (claim.evidenceIds ?? []).map(String);
  const citations = claim.citations ?? [];
  const byId = new Map(evidence.map((item) => [String(item._id), item]));
  const failures = [];
  if (!evidenceIds.length) {
    failures.push({ code: 'EVIDENCE_REQUIRED', message: 'Claim has no supporting evidence.' });
    for (const citation of citations) {
      const evidenceId = String(citation.evidenceId);
      failures.push(byId.has(evidenceId)
        ? { evidenceId, code: 'EVIDENCE_ID_NOT_LINKED', message: 'Citation evidenceId is not linked to this claim.' }
        : { evidenceId, code: 'EVIDENCE_NOT_FOUND', message: 'Referenced evidence does not exist in this case.' });
    }
    return { result: 'missing_evidence', valid: false, failures };
  }

  for (const evidenceId of evidenceIds) {
    const record = byId.get(evidenceId);
    if (!record) {
      failures.push({ evidenceId, code: 'EVIDENCE_NOT_FOUND', message: 'Referenced evidence does not exist in this case.' });
      continue;
    }
    const matchingCitations = citations.filter((citation) => String(citation.evidenceId) === evidenceId);
    if (!matchingCitations.length) {
      failures.push({ evidenceId, code: 'CITATION_MISSING', message: 'Provide an exact quotation for each evidence record.' });
      continue;
    }
    for (const citation of matchingCitations) {
      const quote = normalizeWhitespace(citation.quote);
      const source = normalizeWhitespace(record.text);
      if (!quote || !source.includes(quote)) failures.push({ evidenceId, code: 'QUOTE_NOT_FOUND', message: 'Quoted text does not appear in the cited evidence after whitespace normalization.' });
    }
  }

  for (const citation of citations) {
    if (!evidenceIds.includes(String(citation.evidenceId))) failures.push({ evidenceId: String(citation.evidenceId), code: 'EVIDENCE_ID_NOT_LINKED', message: 'Citation evidenceId is not linked to this claim.' });
  }
  const missing = failures.some((failure) => ['EVIDENCE_NOT_FOUND', 'EVIDENCE_REQUIRED'].includes(failure.code));
  return { result: failures.length ? (missing ? 'missing_evidence' : 'failed') : 'passed', valid: failures.length === 0, failures };
}
