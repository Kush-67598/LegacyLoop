import path from 'node:path';
import { SUPPORTED_EXTENSIONS } from '../parsers/parserFactory.js';

const mimeTypes = {
  '.json': new Set(['application/json', 'text/json', 'application/octet-stream']),
  '.csv': new Set(['text/csv', 'application/csv', 'text/plain', 'application/octet-stream']),
  '.md': new Set(['text/markdown', 'text/plain', 'application/octet-stream']),
  '.markdown': new Set(['text/markdown', 'text/plain', 'application/octet-stream']),
  '.zip': new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])
};

export function validateUploadedFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) return { supported: false, reason: 'Unsupported file extension' };
  if (!mimeTypes[extension]?.has((file.mimetype ?? '').toLowerCase())) return { supported: false, reason: 'File MIME type does not match its extension' };
  if (extension === '.zip' && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]))) return { supported: false, reason: 'ZIP file signature is invalid' };
  if (extension !== '.zip' && file.buffer.includes(0)) return { supported: false, reason: 'Text file contains binary data' };
  return { supported: true, extension };
}
