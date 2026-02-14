import { AppError } from './errorHandler.js';

/**
 * Role-based access control middleware.
 * Must be used AFTER auth middleware (requires req.user).
 *
 * Usage: requireRole('ADMIN')
 */
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Forbidden', 403));
  }
  next();
};

export default requireRole;
