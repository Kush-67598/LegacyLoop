import * as caseService from '../services/caseService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const createCase = asyncHandler(async (req, res) => res.status(201).json({ success: true, message: 'Case created successfully', data: await caseService.createCase(req.body, req.user.id) }));
export const listCases = asyncHandler(async (req, res) => res.json({ success: true, message: 'Cases retrieved successfully', data: await caseService.listCases(req.user.id, req.user.role) }));
export const getCase = asyncHandler(async (req, res) => res.json({ success: true, message: 'Case retrieved successfully', data: await caseService.getCase(req.params.id, req.user.id, req.user.role) }));
export const updateCase = asyncHandler(async (req, res) => res.json({ success: true, message: 'Case updated successfully', data: await caseService.updateCase(req.params.id, req.user.id, req.user.role, req.body) }));
export const archiveCase = asyncHandler(async (req, res) => res.json({ success: true, message: 'Case archived successfully', data: await caseService.archiveCase(req.params.id, req.user.id, req.user.role) }));
