import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { textChat, startChat, audioChat, getHistory, clearChat } from '../controllers/chat.controller.js';

const router = Router();

router.post('/', asyncHandler(textChat));
router.post('/start', asyncHandler(startChat));
router.post('/audio', asyncHandler(audioChat));
router.get('/history/:sessionId', getHistory);
router.delete('/:sessionId', clearChat);

export default router;
