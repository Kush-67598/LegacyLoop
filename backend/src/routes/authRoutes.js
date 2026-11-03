import { Router } from 'express';
import { requireDemoUser } from '../middleware/authMiddleware.js';
const router = Router();
router.get('/me', requireDemoUser, (req, res) => res.json({
  success: true,
  message: 'Current demo identity retrieved successfully',
  data: { id: req.user.id, name: req.user.demoIdentity, role: req.user.role }
}));
export default router;
