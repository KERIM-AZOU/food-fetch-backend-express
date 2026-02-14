import axios from 'axios';
import FormData from 'form-data';
import debug from 'debug';
import config from '../config/index.js';
import { trackTokenUsage } from '../utils/tokenTracker.js';

const log = debug('app:groq');
const { apiKey, baseUrl, chatModel, extractionModel, whisperModel } = config.groq;

const authHeaders = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

// ── Whisper transcription ────────────────────────────────────────────

export async function transcribeAudio(audioBase64, mimeType = 'audio/webm') {
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', whisperModel);
  form.append('response_format', 'verbose_json');

  const start = Date.now();
  const response = await axios.post(
    `${baseUrl}/audio/transcriptions`,
    form,
    {
      headers: { 'Authorization': `Bearer ${apiKey}`, ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    },
  );
  log('Whisper — %dms', Date.now() - start);

  trackTokenUsage({
    service: 'transcribe',
    model: whisperModel,
    metadata: { audioMimeType: mimeType, textLength: response.data.text?.length || 0, durationMs: Date.now() - start },
  });

  return {
    text: response.data.text || '',
    language: response.data.language || 'en',
  };
}

// ── Food keyword extraction ──────────────────────────────────────────

export async function extractFoodKeywords(text) {
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model: extractionModel,
      messages: [
        {
          role: 'system',
          content: `Extract food/drink items in English. If NO food/drink found, return: NOT_FOOD_RELATED

Rules: Translate to English, space-separate items, ignore filler words.

Examples: "frites"->fries | "أريد بيتزا"->pizza | "poulet avec riz"->chicken rice | "what's the weather"->NOT_FOOD_RELATED | "مرحبا"->NOT_FOOD_RELATED`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: 100,
    },
    { headers: authHeaders },
  );

  const extracted = response.data.choices[0]?.message?.content?.trim() || '';
  log('extracted: %s from: %s', extracted, text);

  trackTokenUsage({
    service: 'search',
    model: extractionModel,
    inputTokens: response.data.usage?.prompt_tokens || 0,
    outputTokens: response.data.usage?.completion_tokens || 0,
    totalTokens: response.data.usage?.total_tokens || 0,
  });

  return extracted;
}

// ── Translation ──────────────────────────────────────────────────────

export async function translateText(text, targetLanguageName) {
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model: extractionModel,
      messages: [
        {
          role: 'user',
          content: `Translate to ${targetLanguageName} (only output translation): ${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 150,
    },
    { headers: authHeaders },
  );

  trackTokenUsage({
    service: 'translate',
    model: extractionModel,
    inputTokens: response.data.usage?.prompt_tokens || 0,
    outputTokens: response.data.usage?.completion_tokens || 0,
    totalTokens: response.data.usage?.total_tokens || 0,
  });

  return response.data.choices[0]?.message?.content?.trim() || text;
}

// ── Chat (Llama) ─────────────────────────────────────────────────────

function getChatSystemPrompt(language = 'en') {
  return `You are Mel, a super friendly and cheerful food assistant. You're like a warm best friend who genuinely cares about people and gets excited about helping them find delicious food. You love food, cooking, and making people smile.

**Rules:**
- Respond in the language: ${language === 'auto' ? "the same language the user is writing in (detect it)" : language}
- Keep responses under 30 words — be concise but expressive
- ALWAYS end with a follow-up question to keep the conversation going naturally
- Remember what the user said earlier and reference it when relevant
- Be warm, encouraging, and enthusiastic — use casual, upbeat language like talking to a close friend
- You LOVE food! If the user mentions food, being hungry, or wanting to eat, get excited and help them find it

**Response format — JSON only, no extra text:**
{"response":"your reply","foodMentioned":bool,"foodItems":["items in english"],"shouldSearch":bool,"shouldStop":bool,"detectedLanguage":"ISO 639-1 code"}

- foodItems: always in English, even if the user speaks another language
- shouldSearch: true when user mentions specific food they want
- shouldStop: true only when user says bye/stop/done/quit/goodbye
- detectedLanguage: the ISO 639-1 language code of the user's message (e.g. "en", "fr", "ar")

**Examples:**
User: "Hi"
{"response":"Hiii! So happy you're here! What are you in the mood for today?","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":false}

User: "I'm starving"
{"response":"Oh noo, let's fix that right away! What sounds yummy to you right now?","foodMentioned":true,"foodItems":[],"shouldSearch":false,"shouldStop":false}

User: "pizza"
{"response":"Yesss, pizza! Amazing choice! Let me find the best ones near you — any favorite toppings?","foodMentioned":true,"foodItems":["pizza"],"shouldSearch":true,"shouldStop":false}

User: "bye"
{"response":"Bye bye! It was so fun chatting with you! Come back whenever you're hungry!","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":true}`;
}

function parseChatResponse(text) {
  function extract(parsed) {
    return {
      response: parsed.response || text,
      foodMentioned: parsed.foodMentioned || false,
      foodItems: parsed.foodItems || [],
      shouldSearch: parsed.shouldSearch || false,
      shouldStop: parsed.shouldStop || false,
      detectedLanguage: parsed.detectedLanguage || null,
    };
  }
  try {
    return extract(JSON.parse(text));
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*"response"[\s\S]*\}/);
    if (jsonMatch) {
      try { return extract(JSON.parse(jsonMatch[0])); } catch { /* fall through */ }
    }
    return { response: text, foodMentioned: false, foodItems: [], shouldSearch: false, shouldStop: false, detectedLanguage: null };
  }
}

export async function chat(userMessage, conversationHistory = [], language = 'en') {
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const messages = [{ role: 'system', content: getChatSystemPrompt(language) }];

  for (const msg of conversationHistory.slice(-4)) {
    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
  }
  messages.push({ role: 'user', content: userMessage });

  const start = Date.now();
  const result = await axios.post(
    `${baseUrl}/chat/completions`,
    { model: chatModel, messages, temperature: 0.7, max_tokens: 150, response_format: { type: 'json_object' } },
    { headers: authHeaders },
  );
  log('chat — %dms', Date.now() - start);

  trackTokenUsage({
    service: 'chat',
    model: chatModel,
    inputTokens: result.data.usage?.prompt_tokens || 0,
    outputTokens: result.data.usage?.completion_tokens || 0,
    totalTokens: result.data.usage?.total_tokens || 0,
  });

  const responseText = result.data.choices?.[0]?.message?.content || '';
  log('raw LLM response: %s', responseText);
  return parseChatResponse(responseText);
}

export function generateGreeting(language = 'en') {
  const greetings = {
    en: ["Hey there! What's on your mind?", "Hi! How can I help you today?", "Hey! What can I do for you?"],
    ar: ["أهلاً! شو عبالك اليوم؟", "مرحبا! كيف أقدر أساعدك؟", "هلا! شو تبي؟"],
    fr: ["Salut ! Qu'est-ce qui te ferait plaisir ?", "Coucou ! Comment je peux t'aider ?", "Hey ! Quoi de neuf ?"],
    es: ["¡Hola! ¿Qué tienes en mente?", "¡Hey! ¿En qué te puedo ayudar?", "¡Hola! ¿Qué se te antoja?"],
    de: ["Hey! Was hast du auf dem Herzen?", "Hallo! Wie kann ich dir helfen?", "Hi! Was kann ich für dich tun?"],
    zh: ["嘿！你在想什么？", "你好！我能帮你什么？", "嗨！有什么需要的吗？"],
    hi: ["नमस्ते! क्या चल रहा है?", "हाय! मैं कैसे मदद कर सकता हूं?", "हेलो! क्या चाहिए?"],
    pt: ["Oi! O que está pensando?", "E aí! Como posso ajudar?", "Olá! O que posso fazer por você?"],
    ru: ["Привет! Что у тебя на уме?", "Хей! Чем могу помочь?", "Здравствуй! Что тебе нужно?"],
    ja: ["やあ！何を考えてる？", "こんにちは！何かお手伝いできる？", "ハイ！何でも聞いてね！"],
    ko: ["안녕! 무슨 생각 중이야?", "하이! 뭘 도와줄까?", "안녕하세요! 무엇이 필요하세요?"],
    it: ["Ciao! Cosa hai in mente?", "Hey! Come posso aiutarti?", "Ciao! Che mi racconti?"],
    tr: ["Selam! Aklında ne var?", "Merhaba! Nasıl yardımcı olabilirim?", "Hey! Ne yapabilirim senin için?"],
  };

  const list = greetings[language] || greetings.en;
  return { greeting: list[Math.floor(Math.random() * list.length)] };
}
