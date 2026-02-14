import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { synthesize, voices } from '../controllers/tts.controller.js';
import auth from '../middleware/auth.js';
const router = Router();

router.post('/', auth, asyncHandler(synthesize));
router.get('/voices', auth, asyncHandler(voices));

export default router;
