import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const roles = new Set(['admin', 'reviewer', 'successor', 'team_member']);

// Phase 7 continues the development-only identity stub. It is disabled in production.
export async function requireDemoUser(req, res, next) {
  try {
    if (env.nodeEnv === 'production') throw new ApiError(503, 'Authentication is not configured', 'AUTHENTICATION_NOT_CONFIGURED');
    const identity = req.get('x-demo-user')?.trim();
    if (!identity || identity.length > 100) throw new ApiError(401, 'Provide an x-demo-user identity', 'AUTHENTICATION_REQUIRED');
    const requestedRole = req.get('x-demo-role')?.trim() || 'team_member';
    if (!roles.has(requestedRole)) throw new ApiError(400, 'Invalid demo role', 'INVALID_DEMO_ROLE');
    const id = createHash('sha256').update(identity.toLowerCase()).digest('hex').slice(0, 24);
    await User.findOneAndUpdate({ _id: id }, {
      $set: { name: identity, email: `${id}@demo.legacyloop.invalid`, role: requestedRole },
      $setOnInsert: { passwordHash: createHash('sha256').update(randomBytes(32)).digest('hex') }
    }, { upsert: true, returnDocument: 'after', runValidators: true });
    req.user = { id, role: requestedRole, demoIdentity: identity };
    next();
  } catch (error) { next(error); }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) return next(new ApiError(403, 'This action requires an authorized reviewer', 'ROLE_FORBIDDEN'));
    next();
  };
}
