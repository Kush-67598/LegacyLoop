import Evidence from '../models/Evidence.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { filterByPermission } from '../services/permissions/permissionService.js';

export const fileHistory = asyncHandler(async (req, res) => {
  const filename = req.query.file;
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 1000) throw new ApiError(400, 'Provide a valid file query parameter', 'INVALID_FILE_PATH');
  const records = await Evidence.find({ caseId: req.case._id, sourceType: 'git_commit', 'metadata.changedFiles': filename.trim() }).sort({ timestamp: -1 }).lean();
  const history = filterByPermission(records, req.user.role);
  res.json({ success: true, message: 'File history retrieved successfully', data: history });
});
