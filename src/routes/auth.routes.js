import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireFields } from '../middleware/validate.js';
import rateLimiter from '../middleware/rateLimiter.js';
import auth from '../middleware/auth.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register',
  // rateLimiter(20),
  requireFields('email', 'password'),
  asyncHandler(authController.register),
);

router.post('/login',
  // rateLimiter(20),
  requireFields('email', 'password'),
  asyncHandler(authController.login),
);

router.post('/logout',
  auth,
  asyncHandler(authController.logout),
);

router.post('/logout-all',
  auth,
  asyncHandler(authController.logoutAll),
);

router.post('/forgot-password',
  // rateLimiter(5),
  requireFields('email'),
  asyncHandler(authController.forgotPassword),
);

router.post('/reset-password',
  requireFields('token', 'newPassword'),
  asyncHandler(authController.resetPassword),
);

export default router;
