const settings = [
  { key: 'retry', pattern: /\bretr(?:y|ies)\b/i },
  { key: 'timeout', pattern: /\btimeouts?\b/i },
  { key: 'rate_limit', pattern: /\brate[ -]limits?\b/i },
  { key: 'max_attempts', pattern: /\bmax(?:imum)?\s+attempts?\b/i },
  { key: 'port', pattern: /\bports?\b/i },
  { key: 'region', pattern: /\bregions?\b/i },
  { key: 'cache_ttl', pattern: /\bcache\s+ttl\b/i },
  { key: 'log_level', pattern: /\blog\s+levels?\b/i },
  { key: 'queue_size', pattern: /\bqueue\s+sizes?\b/i },
  { key: 'encryption_mode', pattern: /\bencryption(?:\s+mode)?\b/i }
];
const ignoredSubject = new Set(['a', 'an', 'the', 'this', 'that', 'is', 'are', 'was', 'were', 'set', 'limited', 'limit', 'to', 'at', 'of', 'for', 'in', 'on', 'with', 'use', 'uses', 'using', 'should', 'must', 'will', 'value', 'config', 'configuration']);
const eligibleTypes = new Set(['technical_decision', 'configuration', 'general']);

function extractSignature(claim) {
  if (!eligibleTypes.has(claim.claimType)) return null;
  const text = String(claim.text).replaceAll('\\', '/');
  const setting = settings.map((candidate) => ({ ...candidate, match: candidate.pattern.exec(text) })).find((candidate) => candidate.match);
  if (!setting) return null;
  const before = text.slice(0, setting.match.index);
  const file = before.match(/(?:[\w.-]+\/)+[\w.-]+\.[a-z\d]+/i)?.[0]?.toLowerCase();
  const subjectWords = before.toLowerCase().match(/[a-z][a-z\d-]*/g)?.filter((word) => !ignoredSubject.has(word)) ?? [];
  const subject = file ?? subjectWords[0] ?? 'global';
  const environmentMatch = text.match(/\b(production|prod|staging|stage|development|dev|test|qa)\b/i)?.[1]?.toLowerCase();
  const environment = ({ prod: 'production', stage: 'staging', dev: 'development' })[environmentMatch] ?? environmentMatch ?? null;
  const after = text.slice(setting.match.index + setting.match[0].length);
  const numberMatch = after.match(/(?:\b(?:is|are|to|at|of|set\s+to|limited\s+to|maximum\s+of)\s*)?(\d+(?:\.\d+)?)(?:\s*(milliseconds?|ms|seconds?|secs?|minutes?|mins?|hours?|attempts?|percent|%))?/i);
  const boolMatch = after.match(/\b(true|false|enabled|disabled|on|off)\b/i);
  const quotedMatch = after.match(/["']([^"']{1,80})["']/);
  let value = numberMatch ? `${Number(numberMatch[1])}${(numberMatch[2] ?? '').toLowerCase().replace(/attempts?/, '')}` : boolMatch?.[1]?.toLowerCase() ?? quotedMatch?.[1]?.trim().toLowerCase();
  if (!value) return null;
  return { entityKey: `${subject}|${setting.key}${environment ? `|environment:${environment}` : ''}`, value, environment };
}

export function findPotentialConflicts(claim, existingClaims) {
  const signature = extractSignature(claim);
  if (!signature) return [];
  return existingClaims.flatMap((existing) => {
    if (String(existing._id) === String(claim._id)) return [];
    const other = extractSignature(existing);
    if (!other || signature.entityKey !== other.entityKey || signature.environment !== other.environment || signature.value === other.value) return [];
    return [{ claim: existing, entityKey: signature.entityKey, newValue: signature.value, existingValue: other.value }];
  });
}
