import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import logSearch from '../middleware/logSearch.js';
import { search } from '../controllers/search.controller.js';

const router = Router();

router.post('/', logSearch, asyncHandler(search));

export default router;
