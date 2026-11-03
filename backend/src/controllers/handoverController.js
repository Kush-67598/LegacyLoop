import { asyncHandler } from '../utils/asyncHandler.js';
import * as handoverService from '../services/handover/handoverService.js';
export const generate = asyncHandler(async (req, res) => {
  const handover = await handoverService.generateHandover(req.params.id, req.user);
  res.json({ success: true, message: 'Handover generated successfully', data: handover });
});
export const acknowledge = asyncHandler(async (req, res) => {
  const handover = await handoverService.acknowledgeHandover(req.params.id, req.user, req.body);
  res.json({ success: true, message: 'Handover acknowledgement recorded', data: handover });
});
