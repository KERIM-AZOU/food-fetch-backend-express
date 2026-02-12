import 'dotenv/config';

const config = {
  port: parseInt(process.env.FETCH_PORT, 10) || 5006,

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    chatModel: 'llama-3.3-70b-versatile',
    extractionModel: 'llama-3.1-8b-instant',
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
};

export default config;
