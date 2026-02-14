import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { textChat, startChat, audioChat, getHistory, clearChat } from '../controllers/chat.controller.js';
import auth from '../middleware/auth.js';
const router = Router();

router.post('/', auth, asyncHandler(textChat));
router.post('/start', auth, asyncHandler(startChat));
router.post('/audio', auth, asyncHandler(audioChat));
router.get('/history', auth, getHistory);
router.delete('/', auth, clearChat);

export default router;
