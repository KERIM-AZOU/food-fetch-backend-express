import { translateText } from './groq.service.js';

export const LANGUAGE_NAMES = {
  en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese',
  ko: 'Korean', hi: 'Hindi', tr: 'Turkish', nl: 'Dutch', pl: 'Polish',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech',
};

export const PHRASES = {
  greeting: {
    en: 'What would you like to order today?',
    ar: 'ماذا تريد أن تطلب اليوم؟',
    fr: 'Que souhaitez-vous commander aujourd\'hui?',
    es: '¿Qué te gustaría pedir hoy?',
    de: 'Was möchten Sie heute bestellen?',
    it: 'Cosa vorresti ordinare oggi?',
    pt: 'O que você gostaria de pedir hoje?',
    ru: 'Что бы вы хотели заказать сегодня?',
    zh: '你今天想点什么？',
    ja: '今日は何を注文しますか？',
    ko: '오늘 무엇을 주문하시겠습니까?',
    hi: 'आज आप क्या ऑर्डर करना चाहेंगे?',
    tr: 'Bugün ne sipariş etmek istersiniz?',
  },
  no_results: {
    en: 'No results found. Try something else!',
    ar: 'لم يتم العثور على نتائج. جرب شيئًا آخر!',
    fr: 'Aucun résultat trouvé. Essayez autre chose!',
    es: 'No se encontraron resultados. ¡Prueba otra cosa!',
    de: 'Keine Ergebnisse gefunden. Versuchen Sie etwas anderes!',
    it: 'Nessun risultato trovato. Prova qualcos\'altro!',
    pt: 'Nenhum resultado encontrado. Tente outra coisa!',
    ru: 'Ничего не найдено. Попробуйте что-то другое!',
    zh: '没有找到结果。试试别的吧！',
    ja: '結果が見つかりませんでした。他のものを試してください！',
    ko: '결과를 찾을 수 없습니다. 다른 것을 시도해 보세요!',
    hi: 'कोई परिणाम नहीं मिला। कुछ और आज़माएं!',
    tr: 'Sonuç bulunamadı. Başka bir şey deneyin!',
  },
};

/**
 * Translate text using Groq.
 */
export async function translate(text, targetLang) {
  if (targetLang === 'en') return text;
  const langName = LANGUAGE_NAMES[targetLang] || targetLang;
  return translateText(text, langName);
}

/**
 * Translate a well-known phrase (uses cache when available).
 */
export async function translatePhrase(type, language) {
  if (PHRASES[type]?.[language]) return PHRASES[type][language];
  if (PHRASES[type]?.en) return translate(PHRASES[type].en, language);
  return null;
}

/**
 * Get all pre-translated phrases for a language.
 */
export function getAllPhrases(language) {
  const phrases = {};
  for (const [key, translations] of Object.entries(PHRASES)) {
    phrases[key] = translations[language] || translations.en;
  }
  return phrases;
}

/**
 * List supported languages.
 */
export function getSupportedLanguages() {
  return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    code,
    name,
    hasPreTranslated: !!PHRASES.greeting[code],
  }));
}
