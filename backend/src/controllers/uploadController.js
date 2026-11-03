import { asyncHandler } from '../utils/asyncHandler.js';
import { processUploads } from '../services/evidence/evidenceService.js';
export const upload = asyncHandler(async (req, res) => {
  const summary = await processUploads(req.params.id, req.files ?? []);
  const partial = summary.failedFiles.length > 0 || summary.unsupportedFiles.length > 0;
  res.status(partial ? 207 : 200).json({ success: !partial, message: partial ? 'Upload completed with file errors' : 'Upload processed successfully', data: summary });
});
