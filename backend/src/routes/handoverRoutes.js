import { Router } from 'express';
import { requireDemoUser, requireRole } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { acknowledgementSchema } from '../validators/handoverValidator.js';
import * as controller from '../controllers/handoverController.js';
const router = Router();
router.get('/cases/:id/handover', requireDemoUser, controller.generate);
router.post('/handover/:id/acknowledge', requireDemoUser, requireRole('successor'), validateRequest(acknowledgementSchema), controller.acknowledge);
export default router;
