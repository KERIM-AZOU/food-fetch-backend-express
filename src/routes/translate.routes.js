import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { translateText, phrases, languages } from '../controllers/translate.controller.js';
import auth from '../middleware/auth.js';
const router = Router();

router.post('/', auth, asyncHandler(translateText));
router.get('/phrases/:language', auth, phrases);
router.get('/languages', auth, languages);

export default router;
