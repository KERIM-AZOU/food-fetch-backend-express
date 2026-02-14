import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireFields } from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/requireRole.js';
import * as ac from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require auth + ADMIN role
router.use(auth, requireRole('ADMIN'));

// ── User management ──────────────────────────────────────────────────
router.get('/users', asyncHandler(ac.listUsers));
router.get('/users/:id', asyncHandler(ac.getUser));
router.patch('/users/:id', asyncHandler(ac.updateUser));
router.delete('/users/:id', asyncHandler(ac.deleteUser));

// ── Analytics ────────────────────────────────────────────────────────
router.get('/analytics/overview', asyncHandler(ac.overviewHandler));
router.get('/analytics/searches', asyncHandler(ac.searchAnalytics));
router.get('/analytics/platforms', asyncHandler(ac.platformAnalytics));
router.get('/analytics/popular-items', asyncHandler(ac.popularItems));
router.get('/analytics/activity', asyncHandler(ac.userActivity));
router.get('/analytics/geo', asyncHandler(ac.geoAnalytics));
router.get('/analytics/time', asyncHandler(ac.timeAnalytics));

// ── Token analytics ──────────────────────────────────────────────────
router.get('/analytics/tokens', asyncHandler(ac.tokenOverview));
router.get('/analytics/tokens/timeline', asyncHandler(ac.tokenTimeline));
router.get('/analytics/tokens/costs', asyncHandler(ac.tokenCosts));
router.get('/analytics/tokens/billing', asyncHandler(ac.billingReport));
router.get('/users/:id/tokens', asyncHandler(ac.userTokenUsage));
router.get('/users/:id/tokens/summary', asyncHandler(ac.userTokenSummary));
router.get('/users/:id/tokens/timeline', asyncHandler(ac.userTokenTimeline));

// ── Marketer management ──────────────────────────────────────────────
router.post('/marketers', requireFields('name', 'code'), asyncHandler(ac.createMarketer));
router.get('/marketers', asyncHandler(ac.listMarketers));
router.get('/marketers/:id', asyncHandler(ac.getMarketer));
router.patch('/marketers/:id', asyncHandler(ac.updateMarketer));
router.delete('/marketers/:id', asyncHandler(ac.deleteMarketer));
router.get('/marketers/:id/redemptions', asyncHandler(ac.marketerRedemptions));

// ── Marketer analytics ───────────────────────────────────────────────
router.get('/analytics/marketers', asyncHandler(ac.marketerAnalyticsHandler));
router.get('/analytics/marketers/:id', asyncHandler(ac.singleMarketerAnalytics));

// ── Exports ──────────────────────────────────────────────────────────
router.get('/export/searches', asyncHandler(ac.exportSearches));
router.get('/export/users', asyncHandler(ac.exportUsers));
router.get('/export/tokens', asyncHandler(ac.exportTokenUsage));
router.get('/export/marketers', asyncHandler(ac.exportMarketers));

export default router;
