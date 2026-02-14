import config from '../config/index.js';
import { AppError } from './errorHandler.js';

const hits = new Map();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
}, 60_000).unref();

/**
 * In-memory rate limiter middleware.
 * @param {number} [max] — override max requests per window (defaults to config)
 */
const rateLimiter = (max) => {
  const limit = max ?? config.rateLimit.max;
  const windowMs = config.rateLimit.windowMs;

  return (req, _res, next) => {
    const key = req.ip;
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      return next(new AppError('Too many requests, please try again later', 429));
    }

    next();
  };
};

export default rateLimiter;
