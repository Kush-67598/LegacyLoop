import mongoose from 'mongoose';
import Case from '../models/Case.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
function validateCaseId(id) { if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid case ID', 'INVALID_CASE_ID'); }
export async function createCase(input, userId) { return Case.create({ ...input, createdBy: userId }); }
export async function listCases(userId, role = 'team_member') {
  const access = role === 'admin' ? {} : { $or: [{ createdBy: userId }, { reviewerIds: userId }] };
  return Case.find({ ...access, archivedAt: null }).sort({ createdAt: -1 }).lean();
}
export async function getCase(id, userId, role = 'team_member') {
  validateCaseId(id);
  const access = role === 'admin' ? {} : { $or: [{ createdBy: userId }, { reviewerIds: userId }] };
  const result = await Case.findOne({ _id: id, ...access, archivedAt: null }).lean();
  if (!result) throw new ApiError(404, 'Case not found', 'CASE_NOT_FOUND');
  return result;
}
export async function updateCase(id, userId, role, changes) {
  validateCaseId(id);
  const authorizedCase = await Case.exists({ _id: id, archivedAt: null, ...(role === 'admin' ? {} : { createdBy: userId }) });
  if (!authorizedCase) throw new ApiError(404, 'Case not found', 'CASE_NOT_FOUND');
  if (changes.reviewerIds) {
    const reviewerIds = [...new Set(changes.reviewerIds.map(String))];
    const authorizedCount = await User.countDocuments({ _id: { $in: reviewerIds }, role: { $in: ['reviewer', 'admin'] } });
    if (authorizedCount !== reviewerIds.length) throw new ApiError(400, 'Every assigned user must have reviewer or admin role', 'INVALID_CASE_REVIEWERS');
    changes = { ...changes, reviewerIds };
  }
  const result = await Case.findOneAndUpdate({ _id: id, archivedAt: null, ...(role === 'admin' ? {} : { createdBy: userId }) }, { $set: changes }, { returnDocument: 'after', runValidators: true }).lean();
  if (!result) throw new ApiError(404, 'Case not found', 'CASE_NOT_FOUND');
  return result;
}
export async function archiveCase(id, userId, role) {
  validateCaseId(id);
  const result = await Case.findOneAndUpdate({ _id: id, archivedAt: null, ...(role === 'admin' ? {} : { createdBy: userId }) }, { $set: { archivedAt: new Date() } }, { returnDocument: 'after', projection: { _id: 1, archivedAt: 1 } }).lean();
  if (!result) throw new ApiError(404, 'Case not found', 'CASE_NOT_FOUND');
  return result;
}
