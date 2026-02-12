import { textToSpeech, listVoices } from '../services/elevenlabs.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function synthesize(req, res) {
  const { text, voiceId } = req.body;
  if (!text) throw new AppError('Text is required', 400);

  const result = await textToSpeech(text, { voiceId });
  if (!result) {
    throw new AppError('TTS not available — set ELEVENLABS_API_KEY', 500);
  }

  res.json({ audio: result.audio, contentType: result.contentType });
}

export async function voices(_req, res) {
  const list = await listVoices();
  res.json(list);
}
