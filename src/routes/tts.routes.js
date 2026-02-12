import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { synthesize, voices } from '../controllers/tts.controller.js';

const router = Router();

router.post('/', asyncHandler(synthesize));
router.get('/voices', asyncHandler(voices));

export default router;
