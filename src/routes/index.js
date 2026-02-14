import { Router } from 'express';
import searchRoutes from './search.routes.js';
import voiceRoutes from './voice.routes.js';
import transcribeRoutes from './transcribe.routes.js';
import ttsRoutes from './tts.routes.js';
import translateRoutes from './translate.routes.js';
import chatRoutes from './chat.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.use('/search', searchRoutes);
router.use('/process-voice', voiceRoutes);
router.use('/transcribe', transcribeRoutes);
router.use('/tts', ttsRoutes);
router.use('/translate', translateRoutes);
router.use('/chat', chatRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

export default router;
