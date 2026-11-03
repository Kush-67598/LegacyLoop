import { ApiError } from '../utils/ApiError.js';

export function validateRequest(schema, property = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      const details = result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message }));
      return next(new ApiError(400, 'Request validation failed', 'VALIDATION_ERROR', details));
    }
    req[property] = result.data;
    next();
  };
}
