import { rateLimit } from 'express-rate-limit';

const responseHandler = (req, res) => res.status(429).json({
  success: false,
  message: 'Too many requests; try again later',
  error: { code: 'RATE_LIMIT_EXCEEDED' }
});

export const apiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, handler: responseHandler });
export const uploadRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: responseHandler });
