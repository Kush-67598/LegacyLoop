export function parseMarkdown(buffer, sourceName) {
  const text = buffer.toString('utf8').replace(/\0/g, '').trim();
  if (!text) throw new Error('Markdown document is empty');
  return [{ sourceType: 'markdown_document', sourceName, locator: `document:${sourceName}`, text, author: null, timestamp: null, accessLevel: 'team', metadata: { format: 'markdown' } }];
}
