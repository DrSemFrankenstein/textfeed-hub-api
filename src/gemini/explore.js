import { generateFromPromptPayload } from './generate.js';
import { languagePromptName } from './prompts.js';
import { loadEnv } from '../config/env.js';

/** @typedef {{ role: 'user' | 'assistant'; text: string }} ExploreMessage */

function formatLocation(location) {
  if (!location) return 'Location not provided';
  const label = String(location.label || '').trim();
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (label) return label;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return 'Unknown place';
}

async function callGeminiText(apiKey, model, systemPrompt, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim(),
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userText }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 512 },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini ${res.status}`);
  }
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text).filter(Boolean).join('');
  const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Invalid JSON from Gemini');
  return JSON.parse(clean.slice(start, end + 1));
}

export async function exploreChatReply(apiKey, { language, location, messages, model }) {
  const langName = languagePromptName(language);
  const loc = formatLocation(location);
  const history = (messages ?? [])
    .slice(-12)
    .map((m) => `${m.role === 'assistant' ? 'Guide' : 'Traveler'}: ${String(m.text || '').trim()}`)
    .join('\n');

  const userText = `Place context: ${loc}

Conversation:
${history || '(no messages yet)'}

Reply as a concise local travel guide in ${langName}. Help with: what to do nearby, food, facts, practical tips.
If location is vague, ask one short clarifying question.
JSON only: {"reply":"your message"}`;

  const systemPrompt =
    'You are a friendly on-the-ground travel guide. Be specific when location is known. No markdown in reply text.';

  const parsed = await callGeminiText(apiKey, model, systemPrompt, userText);
  const reply = String(parsed.reply || '').trim();
  if (!reply) throw new Error('Empty guide reply');
  return { reply };
}

export async function exploreFeedPayload(
  apiKey,
  { language, slideCount, cardTypeId, location, messages, model },
) {
  const loc = formatLocation(location);
  const history = (messages ?? [])
    .slice(-16)
    .map((m) => `${m.role === 'assistant' ? 'Guide' : 'Traveler'}: ${String(m.text || '').trim()}`)
    .join('\n');

  const prompt = `Create a viral insight carousel for a traveler at this place.

Location: ${loc}

Conversation with traveler:
${history || 'General visit — suggest highlights.'}

Cover: things to do, local food, hidden facts, practical tips for this exact area (region/city level).
Use real place names when confident; otherwise say "nearby" without inventing venues.`;

  return generateFromPromptPayload(apiKey, {
    language,
    slideCount,
    categoryId: 'travel',
    cardTypeId: cardTypeId || 'educational',
    prompt,
    model,
  });
}

export function exploreModel() {
  return loadEnv().geminiModel;
}
