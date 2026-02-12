import axios from 'axios';
import FormData from 'form-data';
import config from '../config/index.js';

const { apiKey, baseUrl, chatModel, extractionModel } = config.groq;

// ── Whisper transcription ────────────────────────────────────────────

export async function transcribeAudio(audioBase64, mimeType = 'audio/webm') {
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', 'whisper-large-v3');
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
  console.log(`[TIMING] Groq Whisper — ${Date.now() - start}ms`);

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
    { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
  );

  const extracted = response.data.choices[0]?.message?.content?.trim() || '';
  console.log('Groq AI extracted:', extracted, 'from:', text);
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
    { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
  );

  return response.data.choices[0]?.message?.content?.trim() || text;
}

// ── Chat (Llama) ─────────────────────────────────────────────────────

function getChatSystemPrompt(language = 'en') {
  return `You are a fun, friendly, and curious AI assistant who loves chatting. You're warm, witty, and genuinely interested in people.

**Rules:**
- Respond in the language: ${language}
- Keep responses under 30 words — be concise but expressive
- ALWAYS end with a follow-up question to keep the conversation going naturally
- Remember what the user said earlier and reference it when relevant
- Be playful and use casual language — like talking to a friend
- You can help find food! If the user mentions food, being hungry, or wanting to eat, extract the food items

**Response format — JSON only, no extra text:**
{"response":"your reply","foodMentioned":bool,"foodItems":["items in english"],"shouldSearch":bool,"shouldStop":bool}

- foodItems: always in English, even if the user speaks another language
- shouldSearch: true when user mentions specific food they want
- shouldStop: true only when user says bye/stop/done/quit/goodbye

**Examples:**
User: "Hi"
{"response":"Hey there! I was just thinking about how cool today is. What's been on your mind?","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":false}

User: "I'm starving"
{"response":"Oh no, we can't have that! What kind of food are you craving right now?","foodMentioned":true,"foodItems":[],"shouldSearch":false,"shouldStop":false}

User: "pizza"
{"response":"Great choice! Let me find some pizza for you. Any particular style you love?","foodMentioned":true,"foodItems":["pizza"],"shouldSearch":true,"shouldStop":false}

User: "bye"
{"response":"It was awesome chatting with you! Come back anytime!","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":true}`;
}

function parseGroqChatResponse(text) {
  try {
    const parsed = JSON.parse(text);
    return {
      response: parsed.response || text,
      foodMentioned: parsed.foodMentioned || false,
      foodItems: parsed.foodItems || [],
      shouldSearch: parsed.shouldSearch || false,
      shouldStop: parsed.shouldStop || false,
    };
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*"response"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          response: parsed.response || text,
          foodMentioned: parsed.foodMentioned || false,
          foodItems: parsed.foodItems || [],
          shouldSearch: parsed.shouldSearch || false,
          shouldStop: parsed.shouldStop || false,
        };
      } catch {
        // fall through
      }
    }
    return { response: text, foodMentioned: false, foodItems: [], shouldSearch: false, shouldStop: false };
  }
}

export async function chat(userMessage, conversationHistory = [], language = 'en') {
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const messages = [{ role: 'system', content: getChatSystemPrompt(language) }];

  for (const msg of conversationHistory.slice(-10)) {
    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
  }
  messages.push({ role: 'user', content: userMessage });

  const start = Date.now();
  console.log('[TIMING] Groq chat — request started');

  const result = await axios.post(
    `${baseUrl}/chat/completions`,
    { model: chatModel, messages, temperature: 0.7, max_tokens: 150 },
    { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
  );
  console.log(`[TIMING] Groq chat — ${Date.now() - start}ms`);

  const responseText = result.data.choices?.[0]?.message?.content || '';
  return parseGroqChatResponse(responseText);
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
