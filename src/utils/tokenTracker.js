import TokenUsage from '../models/TokenUsage.js';

/**
 * Fire-and-forget token usage logger.
 * Call after any external AI API call to track consumption.
 *
 * @param {object} params
 * @param {string} [params.userId]       - User who triggered the call (null for anonymous)
 * @param {string}  params.service       - "search" | "chat" | "tts" | "transcribe" | "translate" | "voice"
 * @param {string} [params.model]        - Model used (e.g. "groq-llama-3.3-70b", "elevenlabs-rachel")
 * @param {number} [params.inputTokens]  - Input tokens consumed
 * @param {number} [params.outputTokens] - Output tokens consumed
 * @param {number} [params.totalTokens]  - Total tokens (or computed from input+output)
 * @param {number} [params.cost]         - Estimated cost in USD
 * @param {object} [params.metadata]     - Extra context (query length, audio duration, etc.)
 */
export function trackTokenUsage({ userId, service, model, inputTokens = 0, outputTokens = 0, totalTokens, cost, metadata }) {
  const total = totalTokens ?? (inputTokens + outputTokens);

  TokenUsage.create({
    userId: userId || null,
    service,
    model: model || null,
    inputTokens,
    outputTokens,
    totalTokens: total,
    cost: cost ?? null,
    metadata: metadata || null,
  }).catch((err) => {
    console.warn(`Failed to track token usage [${service}]:`, err.message);
  });
}
