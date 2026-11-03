import { parse } from 'csv-parse/sync';

export function parseCsv(buffer, sourceName) {
  const rows = parse(buffer.toString('utf8'), { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: false });
  const taskExport = /task|issue|ticket/i.test(sourceName);
  return rows.map((row, index) => {
    const text = row.text ?? row.description ?? row.title ?? row.summary ?? row.message ?? '';
    if (!text.trim()) throw new Error(`CSV record ${index + 1} has no text, description, title, or summary`);
    const locator = row.locator ?? row.id ?? row.key ?? row.number ?? index + 1;
    const { text: _text, description: _description, title: _title, summary: _summary, message: _message, ...metadata } = row;
    return {
      sourceType: taskExport ? 'task' : 'csv_record', sourceName,
      locator: taskExport ? `task:${locator}` : `csv_record:${locator}`,
      text: String(text).trim(), author: row.author ?? row.assignee ?? row.owner ?? null,
      timestamp: row.timestamp ?? row.created_at ?? row.updated_at ?? null,
      accessLevel: row.accessLevel ?? 'team', metadata
    };
  });
}
