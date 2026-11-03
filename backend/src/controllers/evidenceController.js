import Case from '../models/Case.js';
import Evidence from '../models/Evidence.js';
import { listEvidence } from '../services/evidence/evidenceService.js';
import { assertCanAccessLevel } from '../services/permissions/permissionService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

export const listForCase = asyncHandler(async (req, res) => {
  const records = await listEvidence(req.params.id, req.user.role);
  res.json({ success: true, message: 'Evidence retrieved successfully', data: records });
});

export const getById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid evidence ID', 'INVALID_EVIDENCE_ID');
  const record = await Evidence.findById(req.params.id).lean();
  if (!record) throw new ApiError(404, 'Evidence not found', 'EVIDENCE_NOT_FOUND');
  const access = req.user.role === 'admin' ? {} : { $or: [{ createdBy: req.user.id }, { reviewerIds: req.user.id }] };
  const handoverCase = await Case.findOne({ _id: record.caseId, ...access, archivedAt: null }).select('_id').lean();
  if (!handoverCase) throw new ApiError(404, 'Evidence not found', 'EVIDENCE_NOT_FOUND');
  assertCanAccessLevel(req.user.role, record.accessLevel);
  res.json({ success: true, message: 'Evidence retrieved successfully', data: record });
});
