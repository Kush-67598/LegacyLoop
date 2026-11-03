import { asyncHandler } from '../utils/asyncHandler.js';
import * as reviewService from '../services/claims/reviewService.js';
export const review = asyncHandler(async (req, res) => {
  const result = await reviewService.reviewClaim(req.params.id, req.user.id, req.user.role, req.body);
  res.status(201).json({ success: true, message: 'Review action recorded', data: result });
});
export const listForCase = asyncHandler(async (req, res) => {
  const reviews = await reviewService.listCaseReviews(req.params.id, req.user.id, req.user.role);
  res.json({ success: true, message: 'Reviews retrieved successfully', data: reviews });
});
