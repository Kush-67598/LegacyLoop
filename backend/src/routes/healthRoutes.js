import { Router } from 'express';
import { getDatabaseStatus } from '../config/database.js';
const router = Router();
router.get('/', (req, res) => {
  const database = getDatabaseStatus(); const healthy = database === 'connected';
  res.status(healthy ? 200 : 503).json({ success: healthy, message: healthy ? 'Service is healthy' : 'Database is unavailable', data: { status: healthy ? 'ok' : 'unavailable', database } });
});
export default router;
