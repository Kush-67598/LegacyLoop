const TEXT_KEYS = new Set(['text', 'body', 'message', 'title', 'description', 'content']);
const RESERVED_KEYS = new Set(['locator', 'id', 'key', 'number', 'author', 'user', 'name', 'timestamp', 'date', 'ts', 'createdAt', 'updatedAt']);

function recordList(parsed) {
  if (Array.isArray(parsed)) return flattenConversations(parsed);
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON must contain an object or array of records');
  for (const key of ['records', 'messages', 'pull_requests', 'pullRequests', 'tasks', 'items', 'data']) {
    if (Array.isArray(parsed[key])) return flattenConversations(parsed[key]);
  }
  for (const key of ['conversations', 'channels']) {
    if (Array.isArray(parsed[key])) return flattenConversations(parsed[key]);
  }
  return [parsed];
}

function flattenConversations(items) {
  return items.flatMap((item) => {
    const messages = item && (item.messages ?? item.items);
    if (!Array.isArray(messages)) return [item];
    const channel = item.channel ?? item.channel_name ?? item.name ?? item.id ?? item.conversation;
    return messages.map((message) => ({ ...message, channel: message.channel ?? channel }));
  });
}

function inferType(sourceName, item) {
  const hint = `${sourceName} ${item.sourceType ?? ''} ${item.type ?? ''} ${item.kind ?? ''}`.toLowerCase();
  if (/pull.?request|\bpr\b/.test(hint) || item.pull_request === true) return 'pull_request';
  if (/chat|message|conversation/.test(hint) || item.channel) return 'chat_message';
  if (/task|issue|ticket/.test(hint) || item.assignee || item.assigned_to) return 'task';
  return 'manual_entry';
}

function contentText(item) {
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const body = typeof item.body === 'string' ? item.body.trim() : '';
  if (title && body && title !== body) return `${title}\n\n${body}`;
  for (const key of ['text', 'body', 'message', 'title', 'description', 'content']) {
    if (typeof item[key] === 'string' && item[key].trim()) return item[key].trim();
  }
  return '';
}

function getAuthor(item) {
  const value = item.author ?? item.user ?? item.created_by ?? item.createdBy ?? item.assignee ?? item.name;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.name ?? value.login ?? value.username ?? null;
  return null;
}

function normalizeTimestamp(value) {
  if (typeof value === 'number') return new Date(value < 100000000000 ? value * 1000 : value);
  if (typeof value === 'string' && /^\d{10}(\.\d+)?$/.test(value)) return new Date(Number(value) * 1000);
  if (typeof value === 'string' && /^\d{13}$/.test(value)) return new Date(Number(value));
  return value ?? null;
}

export function parseJson(buffer, sourceName) {
  const parsed = JSON.parse(buffer.toString('utf8'));
  const records = recordList(parsed);
  return records.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Record ${index + 1} must be an object`);
    const sourceType = inferType(sourceName, item);
    const text = contentText(item);
    if (!text) throw new Error(`Record ${index + 1} has no usable text or description`);
    const id = item.locator ?? item.id ?? item.key ?? item.number ?? item.ts ?? index + 1;
    const conversation = item.conversation ?? item.channel ?? item.channel_name;
    const locator = item.locator ?? (sourceType === 'chat_message' && conversation
      ? `conversation:${conversation}/message:${id}`
      : `${sourceType}:${id}`);
    const timestamp = normalizeTimestamp(item.timestamp ?? item.date ?? item.ts ?? item.created_at ?? item.createdAt ?? item.updated_at ?? item.updatedAt ?? null);
    const metadata = Object.fromEntries(Object.entries(item).filter(([key]) => !TEXT_KEYS.has(key) && !RESERVED_KEYS.has(key)));
    return { sourceType, sourceName, locator: String(locator), text, author: getAuthor(item), timestamp, accessLevel: item.accessLevel ?? 'team', metadata };
  });
}
