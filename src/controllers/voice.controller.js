import { processVoiceInput } from '../services/voice.service.js';
import { AppError } from '../middleware/errorHandler.js';
import config from '../config/index.js';

export async function processVoice(req, res) {
  const {
    text,
    language = 'en',
    lat = config.defaults.lat,
    lon = config.defaults.lon,
    validate = false,
    useAI = true,
  } = req.body;

  if (!text) throw new AppError('Text is required', 400);

  const result = await processVoiceInput({ text, language, lat, lon, validate, useAI });
  res.json(result);
}
