import { isGeminiEnabled, transcribeAudio as geminiTranscribe } from '../services/gemini.service.js';
import { transcribeAudio as groqTranscribe } from '../services/groq.service.js';
import { AppError } from '../middleware/errorHandler.js';

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

  const audioBuffer = Buffer.from(audio, 'base64');

  // Gemini path
  if (isGeminiEnabled()) {
    console.log('Using Gemini for transcription');
    const result = await geminiTranscribe(audioBuffer, mimeType);

    if (isHallucination(result.text)) {
      console.log('Filtered hallucination (Gemini):', result.text);
      return res.json({ text: '', language: result.language });
    }

    console.log('Gemini transcription:', result.text, '| Language:', result.language);
    return res.json({ text: result.text, language: result.language });
  }

  // Groq Whisper path
  const result = await groqTranscribe(audio, mimeType);

  if (isHallucination(result.text)) {
    console.log('Filtered hallucination:', result.text);
    return res.json({ text: '', language: result.language });
  }

  console.log('Transcription result:', result.text, '| Language:', result.language);
  res.json({ text: result.text, language: result.language });
}
