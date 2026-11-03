import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import Case from '../../models/Case.js';
import Evidence from '../../models/Evidence.js';
import { ApiError } from '../../utils/ApiError.js';
import { parserFor } from '../parsers/parserFactory.js';
import { hashEvidence } from './evidenceHash.js';
import { extractZip } from './zipExtractor.js';
import { parseGitRepository } from '../git/gitParser.js';
import { validateUploadedFile } from './fileValidation.js';
import { redactEvidence } from './redactor.js';
import { filterByPermission } from '../permissions/permissionService.js';

const accessLevels = new Set(['team', 'leads_only', 'restricted']);
const sourceTypes = new Set(['git_commit', 'pull_request', 'chat_message', 'task', 'markdown_document', 'csv_record', 'manual_entry']);

function validateCaseId(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid case ID', 'INVALID_CASE_ID');
}

function safeName(filename) {
  return path.basename(filename.replaceAll('\\', '/')).replace(/[\u0000-\u001f]/g, '').slice(0, 200) || 'upload';
}

function validateNormalized(record, index) {
  if (!sourceTypes.has(record.sourceType)) throw new Error(`Record ${index + 1} has an unsupported source type`);
  if (typeof record.locator !== 'string' || !record.locator.trim()) throw new Error(`Record ${index + 1} has no locator`);
  if (typeof record.text !== 'string' || !record.text.trim()) throw new Error(`Record ${index + 1} has no evidence text`);
  if (record.timestamp && !Number.isFinite(Date.parse(record.timestamp))) throw new Error(`Record ${index + 1} has an invalid timestamp`);
  if (record.accessLevel && !accessLevels.has(record.accessLevel)) throw new Error(`Record ${index + 1} has an invalid access level`);
  return { ...record, sourceName: safeName(record.sourceName), timestamp: record.timestamp ? new Date(record.timestamp) : null, accessLevel: record.accessLevel ?? 'team', metadata: record.metadata ?? {} };
}

async function saveRecords(caseId, records, summary) {
  const types = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = validateNormalized(records[index], index);
    summary.recordsExtracted += 1;
    const hash = hashEvidence(record);
    const redacted = redactEvidence(record);
    const existing = await Evidence.exists({ caseId, hash });
    if (existing) { summary.duplicateRecordsSkipped += 1; continue; }
    try {
      await Evidence.create({ ...redacted.record, originalData: record, redactionApplied: redacted.applied, redactionKinds: redacted.kinds, caseId, hash });
      summary.recordsSaved += 1;
      types.add(record.sourceType);
    } catch (error) {
      if (error.code === 11000) summary.duplicateRecordsSkipped += 1;
      else throw error;
    }
  }
  if (types.size) await Case.updateOne({ _id: caseId }, { $addToSet: { sourceTypes: { $each: [...types] } } });
}

async function processFile(caseId, file, summary) {
  const sourceName = safeName(file.originalname);
  const parser = parserFor(sourceName);
  if (path.extname(sourceName).toLowerCase() === '.zip') {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'legacyloop-zip-'));
    try {
      await extractZip(file.buffer, temporaryRoot);
      const records = await parseGitRepository(temporaryRoot, path.basename(sourceName, path.extname(sourceName)));
      await saveRecords(caseId, records, summary);
      return;
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }
  if (!parser) {
    summary.unsupportedFiles.push({ filename: sourceName, reason: 'Unsupported file extension' });
    return;
  }
  const records = parser(file.buffer, sourceName).map((record) => ({ ...record, sourceName }));
  await saveRecords(caseId, records, summary);
}

export async function processUploads(caseId, files) {
  validateCaseId(caseId);
  if (!files.length) throw new ApiError(400, 'Attach at least one file in the files field', 'UPLOAD_FILES_REQUIRED');
  const found = await Case.exists({ _id: caseId, archivedAt: null });
  if (!found) throw new ApiError(404, 'Case not found', 'CASE_NOT_FOUND');
  const summary = { totalFilesUploaded: files.length, recordsExtracted: 0, recordsSaved: 0, duplicateRecordsSkipped: 0, failedFiles: [], unsupportedFiles: [] };
  for (const file of files) {
    const validation = validateUploadedFile(file);
    if (!validation.supported) { summary.unsupportedFiles.push({ filename: safeName(file.originalname), reason: validation.reason }); continue; }
    try {
      await processFile(caseId, file, summary);
    } catch (error) {
      const safeReason = error.message.replaceAll(os.tmpdir(), '[temporary directory]').replace(/\/[^\s:]*legacyloop-zip-[^\s:]*/g, '[temporary path]');
      summary.failedFiles.push({ filename: safeName(file.originalname), reason: safeReason });
    }
  }
  return summary;
}

export async function listEvidence(caseId, role, options = {}) {
  validateCaseId(caseId);
  const filter = { caseId };
  if (options.sourceType) filter.sourceType = options.sourceType;
  const records = await Evidence.find(filter).sort({ timestamp: 1, createdAt: 1 }).lean();
  return filterByPermission(records, role);
}

export async function getEvidence(id, caseId) {
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(caseId)) throw new ApiError(400, 'Invalid evidence ID', 'INVALID_EVIDENCE_ID');
  const record = await Evidence.findOne({ _id: id, caseId }).lean();
  if (!record) throw new ApiError(404, 'Evidence not found', 'EVIDENCE_NOT_FOUND');
  return record;
}
