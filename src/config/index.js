import 'dotenv/config';

const config = {
  port: parseInt(process.env.FETCH_PORT, 10) || 5006,

  useGemini: process.env.USE_GEMINI === 'true',

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    chatModel: 'llama-3.3-70b-versatile',
    extractionModel: 'llama-3.1-8b-instant',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    baseUrl: 'https://aiplatform.googleapis.com/v1/publishers/google/models',
    chatModel: 'gemini-2.5-flash-lite',
    ttsModel: 'gemini-2.5-flash-preview-tts',
  },

  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    defaultVoiceId: '21m00Tcm4TlvDq8ikWAM',       // Rachel
    chatVoiceId: 'EXAVITQu4vr4xnSDxMaL',           // Bella
  },

  defaults: {
    lat: 25.2855,
    lon: 51.5314,
  },
};

export default config;
