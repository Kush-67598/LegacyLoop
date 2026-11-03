import { generateAnalysis } from '../services/analysis/analysisService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function resultFor(req) {
  const report = await generateAnalysis(req.params.id, { departingMember: req.case.departingMember, role: req.user.role });
  return report;
}
export const analyze = asyncHandler(async (req, res) => res.json({ success: true, message: 'Analysis generated successfully', data: await resultFor(req) }));
export const ownership = asyncHandler(async (req, res) => res.json({ success: true, message: 'Ownership analysis retrieved successfully', data: (await resultFor(req)).ownership }));
export const openWork = asyncHandler(async (req, res) => res.json({ success: true, message: 'Open work analysis retrieved successfully', data: (await resultFor(req)).openWork }));
export const timeline = asyncHandler(async (req, res) => res.json({ success: true, message: 'Evidence timeline retrieved successfully', data: (await resultFor(req)).timeline }));
export const contributors = asyncHandler(async (req, res) => res.json({ success: true, message: 'Contributor analysis retrieved successfully', data: (await resultFor(req)).contributors }));
