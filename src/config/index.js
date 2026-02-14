import 'dotenv/config';

const config = {
  port: parseInt(process.env.FETCH_PORT, 10) || 5006,

  mongoUri: process.env.MONGO_URI || 'mongodb://root:secret@localhost:27017/foodfetch?authSource=admin',

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    chatModel: 'llama-3.3-70b-versatile',
    extractionModel: 'llama-3.1-8b-instant',
    whisperModel: 'whisper-large-v3',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
    ttsModel: 'tts-1',
    defaultVoice: 'nova',
    chatVoice: 'nova',
  },

  defaults: {
    lat: 25.2855,
    lon: 51.5314,
  },

  search: {
    perPage: 12,
    platformTimeout: 15_000,
    snoonuTimeout: 10_000,
    snoonuPageSize: 150,
    snoonuProductSize: 110,
    talabatLimit: 150,
    validationMinResults: 3,
  },

  chat: {
    maxHistory: 20,
    sessionTTL: 60 * 60 * 1000,       // 1 hour
    cleanupInterval: 5 * 60 * 1000,   // 5 minutes
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  rateLimit: {
    windowMs: 60 * 1000,                                             // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
};

export default config;
