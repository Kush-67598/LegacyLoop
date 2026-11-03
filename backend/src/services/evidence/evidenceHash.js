import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function hashEvidence(record) {
  const canonical = JSON.stringify(canonicalize({
    sourceType: record.sourceType,
    sourceName: record.sourceName,
    locator: record.locator,
    text: record.text,
    author: record.author ?? null,
    timestamp: record.timestamp ? new Date(record.timestamp).toISOString() : null,
    accessLevel: record.accessLevel ?? 'team',
    metadata: record.metadata ?? {}
  }));
  return createHash('sha256').update(canonical).digest('hex');
}
