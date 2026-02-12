import axios from 'axios';
import config from '../config/index.js';
import { pcmToWav } from '../utils/pcmToWav.js';

const { apiKey, baseUrl, chatModel: MODEL, ttsModel: TTS_MODEL } = config.gemini;

// ── helpers ──────────────────────────────────────────────────────────

async function callVertexAI(model, body, label = '') {
  const tag = label || model;
  const start = Date.now();
  console.log(`[TIMING] ${tag} — request started`);
  const response = await axios.post(
    `${baseUrl}/${model}:generateContent?key=${apiKey}`,
    body,
    { headers: { 'Content-Type': 'application/json' } },
  );
  console.log(`[TIMING] ${tag} — ${Date.now() - start}ms`);
  return response.data;
}

function extractText(response) {
  const candidates = response.candidates || [];
  if (candidates.length > 0) {
    const parts = candidates[0].content?.parts || [];
    for (const part of parts) {
      if (part.text) return part.text;
    }
  }
  return '';
}

// ── public API ───────────────────────────────────────────────────────

export function isGeminiEnabled() {
  return config.useGemini && !!apiKey;
}

export async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const audioBase64 = audioBuffer.toString('base64');

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        {
          text: `Transcribe this audio exactly as spoken. Also detect the language.
Return your response in this exact JSON format:
{"text": "the transcription here", "language": "language code like en, ar, fr, es, etc"}

If the audio is silent or contains no speech, return:
{"text": "", "language": "en"}

Only return the JSON, nothing else.`,
        },
      ],
    }],
  });

  const responseText = extractText(result).trim();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { text: parsed.text || '', language: parsed.language || 'en' };
    }
  } catch {
    console.error('Failed to parse Gemini transcription response:', responseText);
  }

  return { text: responseText, language: 'en' };
}

export async function extractFoodKeywords(text) {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [{
        text: `Extract food/drink items in English. If NO food/drink found, return exactly: NOT_FOOD_RELATED

Rules: Translate to English, space-separate items, ignore filler words.

Examples: "frites"->fries | "pizza"->pizza | "poulet avec riz"->chicken rice | "what's the weather"->NOT_FOOD_RELATED | "hello"->NOT_FOOD_RELATED

Input: "${text}"

Output only the extracted keywords or NOT_FOOD_RELATED, nothing else:`,
      }],
    }],
  });

  const extracted = extractText(result).trim();
  console.log('Gemini extracted:', extracted, 'from:', text);
  return extracted;
}

export async function translateText(text, targetLanguage) {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [{ text: `Translate to ${targetLanguage}. Only output the translation, nothing else:\n"${text}"` }],
    }],
  });

  return extractText(result).trim();
}

export async function textToSpeech(text) {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const ttsStart = Date.now();
  console.log('[TIMING] TTS — request started');

  const response = await axios.post(
    `${baseUrl}/${TTS_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    },
    { headers: { 'Content-Type': 'application/json' } },
  );

  const candidates = response.data?.candidates || [];
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.mimeType?.includes('audio')) {
        console.log(`[TIMING] TTS — ${Date.now() - ttsStart}ms`);

        const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
        const rateMatch = part.inlineData.mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

        const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
        return { audio: wavBuffer.toString('base64'), contentType: 'audio/wav' };
      }
    }
  }

  console.log('Gemini TTS: No audio in response');
  return null;
}

export async function processAudioForFood(audioBuffer, mimeType = 'audio/webm') {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const audioBase64 = audioBuffer.toString('base64');

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        {
          text: `You are an AI assistant. Listen to this audio and:
1. Transcribe exactly what was said.
2. Detect the language.
3. Extract any food/drink items mentioned (in English).
4. Determine if the request is about food.

Return JSON in this exact format:
{
  "transcription": "words spoken",
  "language": "language code (e.g., en, ar)",
  "foodKeywords": "food items, space-separated",
  "isFood": boolean
}

If silent or unclear, set transcription to "" and isFood to false.
Return only JSON.`,
        },
      ],
    }],
  });

  const responseText = extractText(result).trim();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        text: parsed.transcription || '',
        language: parsed.language || 'en',
        searchQuery: parsed.foodKeywords || '',
        isFood: parsed.isFood || false,
      };
    }
  } catch {
    console.error('Failed to parse Gemini food processing response:', responseText);
  }

  return { text: responseText, language: 'en', searchQuery: '', isFood: false };
}

export async function chat(userMessage, conversationHistory = []) {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const systemPrompt = `You are a general-purpose, friendly, and conversational AI assistant.

**Your primary goal is to have an engaging conversation with the user on ANY topic.**

Always be curious and ask a follow-up question to keep the conversation flowing naturally.

You also have a special skill: you can help users find food.
- If the user explicitly mentions wanting to eat, being hungry, or asks for food, offer to help.
- If they accept your help for a food search, set \`shouldSearch\` to true.
- Extract mentioned food items into the \`foodItems\` array.

**IMPORTANT:** Do NOT mention food or ordering unless the user brings it up first.

Respond in this exact JSON format:
{
  "response": "Your conversational reply, ending with a question.",
  "foodMentioned": boolean,
  "foodItems": string[],
  "shouldSearch": boolean
}`;

  const contents = conversationHistory.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const result = await callVertexAI(MODEL, {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.8, maxOutputTokens: 500 },
  });

  const responseText = extractText(result).trim();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        response: parsed.response || responseText,
        foodMentioned: parsed.foodMentioned || false,
        foodItems: parsed.foodItems || [],
        shouldSearch: parsed.shouldSearch || false,
      };
    }
  } catch {
    console.error('Failed to parse chat response as JSON:', responseText);
  }

  return { response: responseText, foodMentioned: false, foodItems: [], shouldSearch: false };
}

export async function generateGreeting() {
  if (!apiKey) return "Hey there! What's on your mind?";

  try {
    const result = await callVertexAI(MODEL, {
      contents: [{
        role: 'user',
        parts: [{ text: 'Generate a short, warm, friendly greeting for a general-purpose AI assistant. Keep it under 25 words. Be casual and inviting.' }],
      }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 100 },
    });
    return extractText(result).trim();
  } catch (error) {
    console.error('Greeting generation error:', error.message);
    return "Hey there! What's on your mind?";
  }
}
