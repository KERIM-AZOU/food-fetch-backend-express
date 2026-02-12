import { isGeminiEnabled, extractFoodKeywords as geminiExtract, translateText as geminiTranslate } from '../services/gemini.service.js';
import { extractFoodKeywords as groqExtract, translateText as groqTranslate } from '../services/groq.service.js';
import { extractKeywords } from '../utils/voiceProcessor.js';
import { searchSnoonu } from '../platforms/snoonu.js';
import { AppError } from '../middleware/errorHandler.js';
import { LANGUAGE_NAMES } from '../services/translate.service.js';
import config from '../config/index.js';

async function extractWithAI(text) {
  if (isGeminiEnabled()) {
    try {
      return await geminiExtract(text);
    } catch (err) {
      console.error('Gemini extraction error, falling back to Groq:', err.message);
    }
  }
  return groqExtract(text);
}

async function translateMessage(text, language) {
  if (language === 'en') return text;
  const langName = LANGUAGE_NAMES[language] || language;

  if (isGeminiEnabled()) {
    try {
      return await geminiTranslate(text, langName);
    } catch (err) {
      console.error('Gemini translation error, falling back to Groq:', err.message);
    }
  }

  return groqTranslate(text, langName);
}

export async function processVoice(req, res) {
  const {
    text,
    language = 'en',
    lat = config.defaults.lat,
    lon = config.defaults.lon,
    validate = false,
    useAI = true,
  } = req.body;

  if (!text) throw new AppError('Text is required', 400);

  let search_query;
  let search_terms;

  if (useAI) {
    const aiResult = await extractWithAI(text);

    if (aiResult === 'NOT_FOOD_RELATED') {
      const notFoodMessage = await translateMessage(
        "Your request doesn't seem to be about food. Please ask about food items you'd like to search for.",
        language,
      );
      return res.json({
        search_terms: [],
        search_query: '',
        search_message: notFoodMessage,
        language,
        original_text: text,
        validated: false,
        result_count: 0,
        ai_extracted: true,
        not_food_related: true,
      });
    }

    if (aiResult) {
      search_query = aiResult;
      search_terms = aiResult.split(/\s+/).filter((w) => w.length > 0);
    }
  }

  // Fallback to simple extraction
  if (!search_query) {
    const simple = extractKeywords(text);
    search_query = simple.search_query;
    search_terms = simple.search_terms;
  }

  let result_count = 0;
  let validated = false;

  if (validate && search_query) {
    const testResults = await searchSnoonu(search_query, lat, lon);
    result_count = testResults.length;
    validated = result_count > 0;

    if (!validated && search_terms.length > 1) {
      for (let i = search_terms.length - 1; i >= 1; i--) {
        const shorterQuery = search_terms.slice(0, i).join(' ');
        const shorterResults = await searchSnoonu(shorterQuery, lat, lon);
        if (shorterResults.length >= 3) {
          result_count = shorterResults.length;
          validated = true;
          break;
        }
      }
    }
  }

  const searchMessage = await translateMessage(`Searching for ${search_query}`, language);

  res.json({
    search_terms,
    search_query,
    search_message: searchMessage,
    language,
    original_text: text,
    validated,
    result_count,
    ai_extracted: useAI,
  });
}
