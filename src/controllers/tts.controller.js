import { isGeminiEnabled, textToSpeech as geminiTTS } from '../services/gemini.service.js';
import { textToSpeech as elevenlabsTTS, listVoices } from '../services/elevenlabs.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function synthesize(req, res) {
  const { text, voiceId, language = 'en' } = req.body;
  if (!text) throw new AppError('Text is required', 400);

  // Gemini TTS (no ElevenLabs fallback when Gemini is enabled)
  if (isGeminiEnabled()) {
    console.log('Using Gemini TTS');
    const result = await geminiTTS(text, language);
    if (result?.audio) {
      return res.json({ audio: result.audio, contentType: result.contentType || 'audio/wav' });
    }
    throw new AppError('Gemini TTS failed to generate audio', 500);
  }

  // ElevenLabs path
  const result = await elevenlabsTTS(text, { voiceId });
  if (!result) {
    throw new AppError('TTS not available — set ELEVENLABS_API_KEY or enable Gemini with USE_GEMINI=true', 500);
  }

  res.json({ audio: result.audio, contentType: result.contentType });
}

export async function voices(_req, res) {
  const list = await listVoices();
  res.json(list);
}
