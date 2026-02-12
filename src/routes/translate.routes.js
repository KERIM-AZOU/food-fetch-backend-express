import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { translateText, phrases, languages } from '../controllers/translate.controller.js';

const router = Router();

router.post('/', asyncHandler(translateText));
router.get('/phrases/:language', phrases);
router.get('/languages', languages);

export default router;
