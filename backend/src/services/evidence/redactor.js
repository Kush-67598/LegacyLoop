const patterns = [
  { kind: 'credential', regex: /\b(api[_-]?key|access[_-]?token|auth(?:orization)?|client[_-]?secret|password)\s*[:=]\s*([^\s,;"']+)/gi, replacement: '$1=[REDACTED]' },
  { kind: 'bearer_token', regex: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: 'Bearer [REDACTED]' },
  { kind: 'credential', regex: /\b(?:AKIA[0-9A-Z]{16}|(?:sk|pk|rk|ghp|gho|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,})\b/g, replacement: '[REDACTED_CREDENTIAL]' },
  { kind: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED_EMAIL]' }
];

export function redactText(value, { includePhone = true } = {}) {
  let text = String(value);
  const kinds = new Set();
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) {
      kinds.add(pattern.kind);
      pattern.regex.lastIndex = 0;
      text = text.replace(pattern.regex, pattern.replacement);
    }
  }
  if (includePhone) {
    const phonePattern = /(?<![\w])(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?!\w)/g;
    if (phonePattern.test(text)) {
      kinds.add('phone');
      phonePattern.lastIndex = 0;
      text = text.replace(phonePattern, '[REDACTED_PHONE]');
    }
  }
  return { text, kinds: [...kinds] };
}

function redactMetadata(value, key = '', kinds = new Set()) {
  if (Array.isArray(value)) return value.map((item) => redactMetadata(item, key, kinds));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redactMetadata(child, childKey, kinds)]));
  }
  if (typeof value !== 'string') return value;
  const result = redactText(value, { includePhone: /phone|mobile|telephone/i.test(key) });
  for (const kind of result.kinds) kinds.add(kind);
  return result.text;
}

export function redactEvidence(record) {
  const kinds = new Set();
  const text = redactText(record.text);
  for (const kind of text.kinds) kinds.add(kind);
  const author = record.author ? redactText(record.author) : null;
  for (const kind of author?.kinds ?? []) kinds.add(kind);
  return {
    record: {
      ...record,
      sourceName: redactMetadata(record.sourceName, 'sourceName', kinds),
      locator: redactMetadata(record.locator, 'locator', kinds),
      text: text.text,
      author: author?.text ?? null,
      metadata: redactMetadata(record.metadata ?? {}, 'metadata', kinds)
    },
    applied: kinds.size > 0,
    kinds: [...kinds]
  };
}
