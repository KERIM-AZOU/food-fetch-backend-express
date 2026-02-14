import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';
import { verifySession } from '../services/auth.service.js';

/**
 * JWT authentication middleware.
 * Verifies token, checks session exists (for revocation), and attaches user to req.
 */
const auth = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret);

    // Check if session was revoked
    const valid = await verifySession(payload.jti);
    if (!valid) {
      return next(new AppError('Session revoked', 401));
    }

    req.user = { id: payload.sub, email: payload.email, role: payload.role, jti: payload.jti };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    next(new AppError(message, 401));
  }
};

export default auth;
