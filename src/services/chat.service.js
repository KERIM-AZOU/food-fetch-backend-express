import { isGeminiEnabled } from './gemini.service.js';
import * as geminiService from './gemini.service.js';
import * as groqService from './groq.service.js';
import * as elevenlabsService from './elevenlabs.service.js';

// ── In-memory session store ──────────────────────────────────────────

const conversations = new Map();

// Cleanup stale sessions every 5 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, data] of conversations) {
    if (data.lastActivity < oneHourAgo) {
      conversations.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

function getOrCreateConversation(sessionId, extra = {}) {
  let conv = conversations.get(sessionId);
  if (!conv) {
    conv = { history: [], lastActivity: Date.now(), lastFoodItems: [], ...extra };
    conversations.set(sessionId, conv);
  }
  return conv;
}

function trimHistory(conversation, max = 20) {
  if (conversation.history.length > max) {
    conversation.history = conversation.history.slice(-max);
  }
}

// ── TTS helper (uses ElevenLabs for chat, Gemini for standalone) ─────

async function chatTTS(text) {
  try {
    const result = await elevenlabsService.textToSpeech(text, { forChat: true });
    if (result) return { data: result.audio, contentType: result.contentType };
  } catch (err) {
    console.error('ElevenLabs TTS error:', err.message);
  }
  return null;
}

// ── Transcription helper ─────────────────────────────────────────────

async function chatTranscribe(audioBase64, mimeType) {
  return groqService.transcribeAudio(audioBase64, mimeType);
}

// ── Public API ───────────────────────────────────────────────────────

export async function handleTextChat({ message, sessionId = 'default', generateAudio = true, language = 'en' }) {
  const conversation = getOrCreateConversation(sessionId);

  let stepStart = Date.now();
  const result = await groqService.chat(message, conversation.history, language);
  console.log(`[TIMING] /chat text chat — ${Date.now() - stepStart}ms`);

  conversation.history.push({ role: 'user', content: message });
  conversation.history.push({ role: 'assistant', content: result.response });
  conversation.lastActivity = Date.now();

  if (result.foodMentioned && result.foodItems?.length > 0) {
    conversation.lastFoodItems = result.foodItems;
  }
  const foodItems = result.foodItems?.length > 0 ? result.foodItems : conversation.lastFoodItems;
  trimHistory(conversation);

  let audio = null;
  if (generateAudio && result.response) {
    stepStart = Date.now();
    audio = await chatTTS(result.response);
    console.log(`[TIMING] /chat text TTS — ${Date.now() - stepStart}ms`);
  }

  return {
    response: result.response,
    foodMentioned: result.foodMentioned,
    foodItems,
    shouldSearch: result.shouldSearch,
    shouldStop: result.shouldStop || false,
    sessionId,
    audio,
  };
}

export async function handleStartChat({ sessionId, generateAudio = true, language = 'en' }) {
  const routeStart = Date.now();
  const result = groqService.generateGreeting(language);
  console.log(`[TIMING] /chat/start greeting — ${Date.now() - routeStart}ms`);

  const conversation = getOrCreateConversation(sessionId);
  conversation.history = [{ role: 'assistant', content: result.greeting }];
  conversation.lastActivity = Date.now();

  let audio = null;
  if (generateAudio && result.greeting) {
    const ttsStart = Date.now();
    audio = await chatTTS(result.greeting);
    console.log(`[TIMING] /chat/start TTS — ${Date.now() - ttsStart}ms`);
  }

  console.log(`[TIMING] /chat/start TOTAL — ${Date.now() - routeStart}ms`);
  return { greeting: result.greeting, sessionId, audio };
}

export async function handleAudioChat({ audio: audioBase64, mimeType = 'audio/webm', sessionId = 'default' }) {
  const routeStart = Date.now();

  let stepStart = Date.now();
  const transcriptionResult = await chatTranscribe(audioBase64, mimeType);
  const transcript = transcriptionResult?.text || '';
  const detectedLanguage = transcriptionResult?.language || 'en';
  console.log(`[TIMING] /chat/audio transcribe — ${Date.now() - stepStart}ms`);
  console.log('Transcribed:', transcript, 'Language:', detectedLanguage);

  if (!transcript.trim()) {
    return {
      response: "I didn't catch that. Could you try again?",
      transcript: '',
      foodMentioned: false,
      foodItems: [],
      shouldSearch: false,
      sessionId,
      audio: null,
    };
  }

  const conversation = getOrCreateConversation(sessionId, { language: detectedLanguage });
  conversation.language = detectedLanguage;

  stepStart = Date.now();
  const result = await groqService.chat(transcript, conversation.history, detectedLanguage);
  console.log(`[TIMING] /chat/audio chat — ${Date.now() - stepStart}ms`);

  conversation.history.push({ role: 'user', content: transcript });
  conversation.history.push({ role: 'assistant', content: result.response });
  conversation.lastActivity = Date.now();

  if (result.foodMentioned && result.foodItems?.length > 0) {
    conversation.lastFoodItems = result.foodItems;
  }
  const foodItems = result.foodItems?.length > 0 ? result.foodItems : conversation.lastFoodItems;
  trimHistory(conversation);

  stepStart = Date.now();
  let audioResponse = null;
  try {
    audioResponse = await chatTTS(result.response);
  } catch (err) {
    console.error('TTS error:', err.message);
  }
  console.log(`[TIMING] /chat/audio TTS — ${Date.now() - stepStart}ms`);

  console.log(`[TIMING] /chat/audio TOTAL — ${Date.now() - routeStart}ms`);
  return {
    response: result.response,
    transcript,
    foodMentioned: result.foodMentioned,
    foodItems,
    shouldSearch: result.shouldSearch,
    shouldStop: result.shouldStop || false,
    sessionId,
    audio: audioResponse,
  };
}

export function getHistory(sessionId) {
  const conversation = conversations.get(sessionId);
  if (!conversation) return null;
  return { sessionId, history: conversation.history, lastActivity: conversation.lastActivity };
}

export function clearConversation(sessionId) {
  conversations.delete(sessionId);
}
