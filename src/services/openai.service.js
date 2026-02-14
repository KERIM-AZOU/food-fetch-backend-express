import axios from 'axios';
import debug from 'debug';
import config from '../config/index.js';
import { trackTokenUsage } from '../utils/tokenTracker.js';

const log = debug('app:openai');
const { apiKey, baseUrl, ttsModel, defaultVoice, chatVoice } = config.openai;

const authHeaders = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

// ── Text-to-Speech ───────────────────────────────────────────────────

export async function textToSpeech(text, { voice, forChat = false } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const selectedVoice = voice || (forChat ? chatVoice : defaultVoice);

  const start = Date.now();
  const response = await axios.post(
    `${baseUrl}/audio/speech`,
    { model: ttsModel, input: text, voice: selectedVoice, response_format: 'mp3' },
    {
      headers: authHeaders,
      responseType: 'arraybuffer',
      timeout: config.search.platformTimeout,
    },
  );
  log('TTS — %dms', Date.now() - start);

  trackTokenUsage({
    service: 'tts',
    model: `${ttsModel}-${selectedVoice}`,
    metadata: { textLength: text.length, durationMs: Date.now() - start },
  });

  return {
    audio: Buffer.from(response.data).toString('base64'),
    contentType: 'audio/mpeg',
  };
}

export function listVoices() {
  return [
    { id: 'alloy', name: 'Alloy', category: 'openai' },
    { id: 'ash', name: 'Ash', category: 'openai' },
    { id: 'ballad', name: 'Ballad', category: 'openai' },
    { id: 'coral', name: 'Coral', category: 'openai' },
    { id: 'echo', name: 'Echo', category: 'openai' },
    { id: 'fable', name: 'Fable', category: 'openai' },
    { id: 'mel', name: 'Mel', category: 'openai' },
    { id: 'nova', name: 'Nova', category: 'openai' },
    { id: 'onyx', name: 'Onyx', category: 'openai' },
    { id: 'sage', name: 'Sage', category: 'openai' },
    { id: 'shimmer', name: 'Shimmer', category: 'openai' },
  ];
}
