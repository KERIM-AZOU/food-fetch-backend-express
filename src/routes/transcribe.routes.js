import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { transcribe } from '../controllers/transcribe.controller.js';

const router = Router();

router.post('/', asyncHandler(transcribe));

export default router;
