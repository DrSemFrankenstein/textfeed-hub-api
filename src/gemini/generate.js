import {
  buildSystemPrompt,
  cardTypePromptHint,
  categoryPromptHint,
  languagePromptName,
  maxOutputTokensFor,
} from './prompts.js';
import { geminiModelsToTry } from './models.js';

const TIMEOUT_MS = 90_000;

function isRetryableGeminiError(message, status) {
  if (status === 503 || status === 429 || status === 500) return true;
  return /not found|not supported|invalid model|404|403|unavailable|high demand|try again later|overloaded|resource exhausted|timeout|abort/i.test(
    String(message),
  );
}

function retryDelayMs(attempt) {
  return Math.min(8000, 1000 * 2 ** attempt);
}

function generationConfig(model, slideCount) {
  const maxOutputTokens = maxOutputTokensFor(slideCount);
  const base = { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens };
  if (model.startsWith('gemini-3')) {
    return { ...base, thinkingConfig: { thinkingLevel: 'low' } };
  }
  return { ...base, thinkingConfig: { thinkingBudget: 0 } };
}

function parseJson(text) {
  const clean = String(text)
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Invalid JSON from Gemini');
  return JSON.parse(clean.slice(start, end + 1));
}

function extractText(data) {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join('');
}

async function callOnce(apiKey, model, userText, systemPrompt, slideCount) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: generationConfig(model, slideCount),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data.error?.message || `HTTP ${res.status}`;
      const err = new Error(`Gemini ${res.status} (${model}): ${message}`);
      err.status = res.status;
      throw err;
    }
    const jsonText = extractText(data);
    if (!jsonText) throw new Error('Empty Gemini response');
    return parseJson(jsonText);
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(apiKey, userText, systemPrompt, slideCount, preferredModel) {
  const models = geminiModelsToTry(preferredModel);
  let lastError = 'Gemini failed';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      console.info(`[gemini] try ${model} (attempt ${attempt + 1}, ${models.length} models in pool)`);
      try {
        return await callOnce(apiKey, model, userText, systemPrompt, slideCount);
      } catch (e) {
        lastError = e instanceof Error ? e.message : lastError;
        const status = e?.status;
        if (!isRetryableGeminiError(lastError, status)) {
          throw e instanceof Error ? e : new Error(lastError);
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, retryDelayMs(attempt)));
          continue;
        }
      }
      break;
    }
    console.warn(`[gemini] fallback after failure on ${model}`);
  }
  throw new Error(lastError);
}

function validatePayload(payload, slideCount) {
  const slides = payload.slides ?? [];
  if (slides.length < slideCount) {
    throw new Error(`Gemini returned ${slides.length} slides, need ${slideCount}`);
  }
  if (slides.length > slideCount) {
    return { ...payload, slides: slides.slice(0, slideCount) };
  }
  return payload;
}

export async function generateSurprisePayload(apiKey, { language, slideCount, categoryId, cardTypeId, model }) {
  const langName = languagePromptName(language);
  const categoryHint = categoryPromptHint(categoryId);
  const scope = categoryHint
    ? `Stay within this theme: ${categoryHint}`
    : 'Pick from any field (science, nature, history, psychology, technology, body, space, food, money, language).';

  const userText = `Generate a carousel with exactly ${slideCount} slides about a RANDOM topic. ${scope}
Card style: ${cardTypePromptHint(cardTypeId)}
Write all text in ${langName}.`;

  const result = await callGemini(
    apiKey,
    userText,
    buildSystemPrompt(language, slideCount, cardTypeId),
    slideCount,
    model,
  );
  return validatePayload(result, slideCount);
}

export async function generateFromPromptPayload(
  apiKey,
  { language, slideCount, categoryId, cardTypeId, prompt, model },
) {
  const hint = categoryPromptHint(categoryId);
  const scoped = hint ? `${prompt}\n\nTheme: ${hint}` : prompt;

  const userText = `Generate an insight carousel with exactly ${slideCount} slides about: ${scoped}
Each slide must surprise the reader with something they likely didn't know — facts, stats, counterintuitive truths, or hidden connections. Avoid generic advice.`;

  const result = await callGemini(
    apiKey,
    userText,
    buildSystemPrompt(language, slideCount, cardTypeId),
    slideCount,
    model,
  );
  return validatePayload(result, slideCount);
}
