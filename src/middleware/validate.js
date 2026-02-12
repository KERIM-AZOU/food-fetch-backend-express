import { AppError } from './errorHandler.js';

/**
 * Creates middleware that validates required fields exist in req.body.
 * @param {string[]} fields — required field names
 */
export function requireFields(...fields) {
  return (req, _res, next) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === '');
    if (missing.length) {
      return next(new AppError(`Missing required fields: ${missing.join(', ')}`, 400));
    }
    next();
  };
}
