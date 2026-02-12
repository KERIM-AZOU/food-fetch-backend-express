import debug from 'debug';
import { extractFoodKeywords, translateText } from './groq.service.js';
import { extractKeywords } from '../utils/voiceProcessor.js';
import { searchSnoonu } from '../platforms/snoonu.js';
import { LANGUAGE_NAMES } from './translate.service.js';
import config from '../config/index.js';

const log = debug('app:voice');

async function translateMessage(text, language) {
  if (language === 'en') return text;
  const langName = LANGUAGE_NAMES[language] || language;
  return translateText(text, langName);
}

/**
 * Extract food keywords from text using AI with simple fallback.
 */
export async function extractSearchQuery(text, { useAI = true } = {}) {
  if (useAI) {
    const aiResult = await extractFoodKeywords(text);

    if (aiResult === 'NOT_FOOD_RELATED') {
      return { search_query: '', search_terms: [], not_food_related: true };
    }

    if (aiResult) {
      return {
        search_query: aiResult,
        search_terms: aiResult.split(/\s+/).filter((w) => w.length > 0),
        not_food_related: false,
      };
    }
  }

  // Fallback to simple extraction
  const simple = extractKeywords(text);
  return { ...simple, not_food_related: false };
}

/**
 * Validate a search query against Snoonu, shortening if needed.
 */
export async function validateQuery(search_query, search_terms, lat, lon) {
  const testResults = await searchSnoonu(search_query, lat, lon);
  if (testResults.length > 0) {
    return { validated: true, result_count: testResults.length };
  }

  // Try progressively shorter queries
  for (let i = search_terms.length - 1; i >= 1; i--) {
    const shorterQuery = search_terms.slice(0, i).join(' ');
    const shorterResults = await searchSnoonu(shorterQuery, lat, lon);
    if (shorterResults.length >= config.search.validationMinResults) {
      log('validated with shorter query: %s', shorterQuery);
      return { validated: true, result_count: shorterResults.length };
    }
  }

  return { validated: false, result_count: 0 };
}

/**
 * Full voice processing pipeline: extract → validate → translate message.
 */
export async function processVoiceInput({ text, language = 'en', lat, lon, validate = false, useAI = true }) {
  const { search_query, search_terms, not_food_related } = await extractSearchQuery(text, { useAI });

  if (not_food_related) {
    const notFoodMessage = await translateMessage(
      "Your request doesn't seem to be about food. Please ask about food items you'd like to search for.",
      language,
    );
    return {
      search_terms: [],
      search_query: '',
      search_message: notFoodMessage,
      language,
      original_text: text,
      validated: false,
      result_count: 0,
      ai_extracted: useAI,
      not_food_related: true,
    };
  }

  let result_count = 0;
  let validated = false;

  if (validate && search_query) {
    ({ validated, result_count } = await validateQuery(search_query, search_terms, lat, lon));
  }

  const searchMessage = await translateMessage(`Searching for ${search_query}`, language);

  return {
    search_terms,
    search_query,
    search_message: searchMessage,
    language,
    original_text: text,
    validated,
    result_count,
    ai_extracted: useAI,
  };
}
