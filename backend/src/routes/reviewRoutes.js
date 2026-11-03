import { Router } from 'express';
import { requireDemoUser } from '../middleware/authMiddleware.js';
import { getCase } from '../services/caseService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listForCase } from '../controllers/reviewController.js';
const router = Router({ mergeParams: true });
router.use(requireDemoUser, asyncHandler(async (req, res, next) => { await getCase(req.params.id, req.user.id, req.user.role); next(); }));
router.get('/', listForCase);
export default router;
