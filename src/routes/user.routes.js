import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireFields } from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(auth);

// Profile
router.get('/me', asyncHandler(userController.getProfile));
router.patch('/me', asyncHandler(userController.updateProfile));
router.patch('/me/password',
  requireFields('currentPassword', 'newPassword'),
  asyncHandler(userController.changePassword),
);

// Saved locations
router.get('/me/locations', asyncHandler(userController.getLocations));
router.post('/me/locations',
  requireFields('label', 'lat', 'lon', 'country'),
  asyncHandler(userController.addLocation),
);
router.patch('/me/locations/:id', asyncHandler(userController.updateLocation));
router.delete('/me/locations/:id', asyncHandler(userController.deleteLocation));
router.patch('/me/locations/:id/default', asyncHandler(userController.setDefaultLocation));

export default router;
