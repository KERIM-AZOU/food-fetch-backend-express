import axios from 'axios';
import config from '../config/index.js';

const { apiKey, defaultVoiceId, chatVoiceId } = config.elevenlabs;

/**
 * Generate speech audio using ElevenLabs.
 * @param {string} text
 * @param {{ voiceId?: string, forChat?: boolean }} options
 */
export async function textToSpeech(text, { voiceId, forChat = false } = {}) {
  if (!apiKey) return null;

  const voice = voiceId || (forChat ? chatVoiceId : defaultVoiceId);
  const voiceSettings = forChat
    ? { stability: 0.3, similarity_boost: 0.8, style: 0.75 }
    : { stability: 0.5, similarity_boost: 0.75 };

  const start = Date.now();
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: voiceSettings },
    {
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      responseType: 'arraybuffer',
      timeout: 15000,
    },
  );
  console.log(`[TIMING] ElevenLabs TTS — ${Date.now() - start}ms`);

  return {
    audio: Buffer.from(response.data).toString('base64'),
    contentType: 'audio/mpeg',
  };
}

/**
 * List available ElevenLabs voices.
 */
export async function listVoices() {
  if (!apiKey) throw new Error('ElevenLabs API key not configured');

  const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });

  return response.data.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
  }));
}
