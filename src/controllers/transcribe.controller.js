import debug from 'debug';
import { transcribeAudio } from '../services/groq.service.js';
import { AppError } from '../middleware/errorHandler.js';

const log = debug('app:transcribe');

const HALLUCINATION_PATTERNS = [
  /^i'?m ready to translate\.?$/i,
  /^thanks for watching\.?$/i,
  /^thank you for watching\.?$/i,
  /^subscribe\.?$/i,
  /^please subscribe\.?$/i,
  /^like and subscribe\.?$/i,
  /^see you (next time|later)\.?$/i,
  /^bye\.?$/i,
  /^goodbye\.?$/i,
  /^thank you\.?$/i,
  /^you$/i,
  /^\s*$/,
];

function isHallucination(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return HALLUCINATION_PATTERNS.some((p) => p.test(trimmed));
}

export async function transcribe(req, res) {
  const { audio, mimeType = 'audio/webm' } = req.body;
  if (!audio) throw new AppError('Audio data is required', 400);

  const result = await transcribeAudio(audio, mimeType);

  if (isHallucination(result.text)) {
    log('filtered hallucination: %s', result.text);
    return res.json({ text: '', language: result.language });
  }

  log('result: %s | lang: %s', result.text, result.language);
  res.json({ text: result.text, language: result.language });
}
