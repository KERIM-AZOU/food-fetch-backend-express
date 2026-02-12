const STOP_WORDS = new Set([
  'a', 'an', 'the', 'some', 'any', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
  'want', 'need', 'get', 'give', 'have', 'like', 'love', 'crave', 'craving',
  'order', 'find', 'search', 'looking', 'show', 'bring', 'make',
  'would', 'could', 'can', 'please', 'just', 'really', 'very', 'wanna',
  'gonna', 'gotta', 'lemme', 'let', 'im', "i'm", 'id', "i'd",
  'um', 'uh', 'hmm', 'oh', 'ah', 'er', 'basically', 'actually',
  'maybe', 'probably', 'think', 'guess', 'something', 'anything', 'stuff',
  'for', 'to', 'from', 'with', 'without', 'and', 'or', 'but', 'of', 'in', 'on', 'at',
  'tonight', 'today', 'now', 'right', 'later', 'soon',
  'here', 'there', 'nearby', 'near', 'close', 'around', 'somewhere', 'anywhere',
  'food', 'eat', 'eating', 'hungry', 'meal', 'dinner', 'lunch', 'breakfast',
  'snack', 'delivery', 'deliver', 'delivered', 'ordering',
  'be', 'is', 'are', 'was', 'were', 'been', 'being',
  'do', 'does', 'did', 'doing', 'done',
  'go', 'going', 'went', 'gone',
  'know', 'see', 'feel', 'look',
  'good', 'great', 'nice', 'best', 'better',
  'one', 'two', 'three', 'first', 'second',
  'also', 'too', 'so', 'then', 'than', 'as', 'if',
  'yes', 'no', 'ok', 'okay', 'sure', 'alright',
  'hey', 'hi', 'hello', 'thanks', 'thank',
]);

export function extractKeywords(text) {
  if (!text?.trim()) {
    return { search_terms: [], search_query: '', original_text: '' };
  }

  const original = text.trim();
  const cleaned = original.toLowerCase().replace(/[^\w\s']/g, ' ');

  const words = cleaned.split(/\s+/).filter((word) => {
    word = word.replace(/^'+|'+$/g, '');
    return word.length >= 2 && !STOP_WORDS.has(word);
  });

  const uniqueKeywords = [...new Set(words)];

  return {
    search_terms: uniqueKeywords,
    search_query: uniqueKeywords.join(' '),
    original_text: original,
  };
}
