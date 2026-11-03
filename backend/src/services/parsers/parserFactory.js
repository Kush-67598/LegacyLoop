import { parseJson } from './jsonParser.js';
import { parseCsv } from './csvParser.js';
import { parseMarkdown } from './markdownParser.js';

export const SUPPORTED_EXTENSIONS = new Set(['.json', '.csv', '.md', '.markdown', '.zip']);
export function parserFor(filename) {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (extension === '.json') return parseJson;
  if (extension === '.csv') return parseCsv;
  if (extension === '.md' || extension === '.markdown') return parseMarkdown;
  return null;
}
