import { env } from '../config/env.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const statusCode = error.statusCode ?? 500;
  const message = statusCode >= 500 && env.nodeEnv === 'production' ? 'An unexpected error occurred' : error.message;
  const responseError = { code: error.code ?? 'INTERNAL_SERVER_ERROR' };
  if (error.details) responseError.details = error.details;
  res.status(statusCode).json({ success: false, message, error: responseError });
}
