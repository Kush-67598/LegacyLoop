import * as claimService from '../services/claims/claimService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createForCase = asyncHandler(async (req, res) => {
  const claim = await claimService.createClaim(req.params.id, req.user.id, req.user.role, req.body);
  res.status(201).json({ success: true, message: 'Claim created and verification checks recorded', data: claim });
});
export const listForCase = asyncHandler(async (req, res) => {
  const claims = await claimService.listClaims(req.params.id, req.user.id, req.user.role);
  res.json({ success: true, message: 'Claims retrieved successfully', data: claims });
});
export const getById = asyncHandler(async (req, res) => {
  const claim = await claimService.getClaim(req.params.id, req.user.id, req.user.role);
  res.json({ success: true, message: 'Claim retrieved successfully', data: claim });
});
export const getConflicts = asyncHandler(async (req, res) => {
  const conflicts = await claimService.getClaimConflicts(req.params.id, req.user.id, req.user.role);
  res.json({ success: true, message: 'Claim conflicts retrieved successfully', data: conflicts });
});
export const updateById = asyncHandler(async (req, res) => {
  const claim = await claimService.updateClaim(req.params.id, req.user.id, req.user.role, req.body);
  res.json({ success: true, message: 'A new claim version was created and verification was rerun', data: claim });
});
