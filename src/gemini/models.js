/**
 * Gemini 3+ text models for carousel JSON generation (fallback order).
 * Keep in sync with frontend/src/lib/geminiModels.ts
 * Note: there is no public `gemini-3.2-flash` API id — Google skipped 3.2 in the catalog.
 */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
];

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

/** @param {string | undefined} preferred */
export function geminiModelsToTry(preferred) {
  const head = (preferred || DEFAULT_GEMINI_MODEL).trim();
  const rest = GEMINI_FALLBACK_MODELS.filter((m) => m !== head);
  return head ? [head, ...rest] : [...GEMINI_FALLBACK_MODELS];
}
