import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';

export const ZIP_LIMITS = Object.freeze({ entries: 5000, expandedBytes: 100 * 1024 * 1024, entryBytes: 50 * 1024 * 1024, compressionRatio: 200 });

function openZip(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zipfile) => error ? reject(error) : resolve(zipfile));
  });
}

function readEntry(zipfile, entry) {
  return new Promise((resolve, reject) => zipfile.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream)));
}

function safeTarget(root, entryName) {
  if (!entryName || entryName.includes('\0') || entryName.startsWith('/') || /^[a-zA-Z]:/.test(entryName)) throw new Error('ZIP contains an unsafe absolute path');
  const normalized = entryName.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (parts.some((part) => part === '..')) throw new Error('ZIP contains a path traversal entry');
  const target = path.resolve(root, normalized);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('ZIP entry escapes the extraction directory');
  return target;
}

export async function extractZip(buffer, destination) {
  const zipfile = await openZip(buffer);
  let count = 0;
  let expandedBytes = 0;
  let archiveError;
  try {
    await new Promise((resolve, reject) => {
      zipfile.on('error', reject);
      zipfile.on('end', () => archiveError ? reject(archiveError) : resolve());
      zipfile.on('entry', async (entry) => {
        try {
          count += 1;
          if (count > ZIP_LIMITS.entries) throw new Error('ZIP exceeds the entry limit');
          const target = safeTarget(destination, entry.fileName);
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if (mode === 0xa000) throw new Error('ZIP symbolic links are not accepted');
          if (entry.fileName.endsWith('/')) {
            await fs.mkdir(target, { recursive: true });
            zipfile.readEntry();
            return;
          }
          if (entry.uncompressedSize > ZIP_LIMITS.entryBytes) throw new Error('ZIP entry exceeds the uncompressed size limit');
          expandedBytes += entry.uncompressedSize;
          if (expandedBytes > ZIP_LIMITS.expandedBytes) throw new Error('ZIP exceeds the expanded size limit');
          if (entry.uncompressedSize > 1024 && entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > ZIP_LIMITS.compressionRatio) throw new Error('ZIP entry exceeds the compression ratio limit');
          await fs.mkdir(path.dirname(target), { recursive: true });
          const stream = await readEntry(zipfile, entry);
          await pipeline(stream, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
          zipfile.readEntry();
        } catch (error) {
          archiveError = error;
          zipfile.close();
          reject(error);
        }
      });
      zipfile.readEntry();
    });
    return { entryCount: count, expandedBytes };
  } finally {
    zipfile.close();
  }
}
