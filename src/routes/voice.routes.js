import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { processVoice } from '../controllers/voice.controller.js';

const router = Router();

router.post('/', asyncHandler(processVoice));

export default router;
