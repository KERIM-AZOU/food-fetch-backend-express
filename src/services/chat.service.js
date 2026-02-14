import debug from 'debug';
import * as groqService from './groq.service.js';
import * as openaiService from './openai.service.js';
import config from '../config/index.js';

const log = debug('app:chat');

// ── In-memory session store ──────────────────────────────────────────

const conversations = new Map();
let cleanupTimer = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - config.chat.sessionTTL;
    for (const [sessionId, data] of conversations) {
      if (data.lastActivity < cutoff) {
        conversations.delete(sessionId);
      }
    }
  }, config.chat.cleanupInterval);
  cleanupTimer.unref();
}

startCleanup();

export function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

function getOrCreateConversation(sessionId, extra = {}) {
  let conv = conversations.get(sessionId);
  if (!conv) {
    conv = { history: [], lastActivity: Date.now(), lastFoodItems: [], ...extra };
    conversations.set(sessionId, conv);
  }
  return conv;
}

function trimHistory(conversation) {
  if (conversation.history.length > config.chat.maxHistory) {
    conversation.history = conversation.history.slice(-config.chat.maxHistory);
  }
}

// ── TTS helper ──────────────────────────────────────────────────────

async function chatTTS(text) {
  try {
    const result = await openaiService.textToSpeech(text, { forChat: true });
    return { data: result.audio, contentType: result.contentType };
  } catch (err) {
    log('OpenAI TTS error: %s', err.message);
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────

export async function handleTextChat({ message, sessionId = 'default', generateAudio = true }) {
  const conversation = getOrCreateConversation(sessionId);
  const language = conversation.language || 'auto';

  let stepStart = Date.now();
  const result = await groqService.chat(message, conversation.history, language);
  log('text chat — %dms', Date.now() - stepStart);

  if (!conversation.language && result.detectedLanguage) {
    conversation.language = result.detectedLanguage;
    log('auto-detected language: %s', result.detectedLanguage);
  }

  conversation.history.push({ role: 'user', content: message });
  conversation.history.push({ role: 'assistant', content: result.response });
  conversation.lastActivity = Date.now();

  if (result.foodItems?.length > 0) {
    conversation.lastFoodItems = result.foodItems;
  }
  // Only use saved food items if this response actually wants to search
  const foodItems = result.foodItems?.length > 0
    ? result.foodItems
    : (result.shouldSearch ? conversation.lastFoodItems : []);
  // Clear saved items once a search is triggered to prevent duplicate searches
  if (result.shouldSearch) conversation.lastFoodItems = [];
  trimHistory(conversation);

  let audio = null;
  if (generateAudio && result.response) {
    stepStart = Date.now();
    audio = await chatTTS(result.response);
    log('text TTS — %dms', Date.now() - stepStart);
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
  log('greeting — %dms', Date.now() - routeStart);

  const conversation = getOrCreateConversation(sessionId);
  conversation.language = language;
  conversation.history = [{ role: 'assistant', content: result.greeting }];
  conversation.lastActivity = Date.now();

  let audio = null;
  if (generateAudio && result.greeting) {
    const ttsStart = Date.now();
    audio = await chatTTS(result.greeting);
    log('start TTS — %dms', Date.now() - ttsStart);
  }

  log('start TOTAL — %dms', Date.now() - routeStart);
  return { greeting: result.greeting, sessionId, audio };
}

export async function handleAudioChat({ audio: audioBase64, mimeType = 'audio/webm', sessionId = 'default' }) {
  const routeStart = Date.now();

  let stepStart = Date.now();
  const transcriptionResult = await groqService.transcribeAudio(audioBase64, mimeType);
  const transcript = transcriptionResult?.text || '';
  const detectedLanguage = transcriptionResult?.language || 'en';
  log('audio transcribe — %dms', Date.now() - stepStart);
  log('transcribed: %s lang: %s', transcript, detectedLanguage);

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
  log('audio chat — %dms', Date.now() - stepStart);

  conversation.history.push({ role: 'user', content: transcript });
  conversation.history.push({ role: 'assistant', content: result.response });
  conversation.lastActivity = Date.now();

  if (result.foodItems?.length > 0) {
    conversation.lastFoodItems = result.foodItems;
  }
  const foodItems = result.foodItems?.length > 0
    ? result.foodItems
    : (result.shouldSearch ? conversation.lastFoodItems : []);
  if (result.shouldSearch) conversation.lastFoodItems = [];
  trimHistory(conversation);

  stepStart = Date.now();
  let audioResponse = null;
  try {
    audioResponse = await chatTTS(result.response);
  } catch (err) {
    log('TTS error: %s', err.message);
  }
  log('audio TTS — %dms', Date.now() - stepStart);

  log('audio TOTAL — %dms', Date.now() - routeStart);
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

export function getHistory(sessionId, { page = 1, limit = 20 } = {}) {
  const conversation = conversations.get(sessionId);
  if (!conversation) return null;

  const total = conversation.history.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const history = conversation.history.slice(start, start + limit);

  return { sessionId, history, lastActivity: conversation.lastActivity, page, limit, total, totalPages };
}

export function clearConversation(sessionId) {
  conversations.delete(sessionId);
}
