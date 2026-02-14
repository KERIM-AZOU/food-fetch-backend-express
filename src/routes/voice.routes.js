import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { processVoice } from '../controllers/voice.controller.js';
import auth from '../middleware/auth.js';
const router = Router();

router.post('/', auth, asyncHandler(processVoice));

export default router;
