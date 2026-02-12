import { translate, translatePhrase, getAllPhrases, getSupportedLanguages } from '../services/translate.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function translateText(req, res) {
  const { text, language = 'en', type } = req.body;

  if (!text && !type) throw new AppError('Text or type is required', 400);

  let translated;

  if (type) {
    translated = await translatePhrase(type, language);
    if (!translated && text) {
      translated = await translate(text, language);
    }
  } else {
    translated = await translate(text, language);
  }

  res.json({ translated: translated || text, language });
}

export function phrases(req, res) {
  const { language } = req.params;
  res.json({ language, phrases: getAllPhrases(language) });
}

export function languages(_req, res) {
  res.json({ languages: getSupportedLanguages() });
}
