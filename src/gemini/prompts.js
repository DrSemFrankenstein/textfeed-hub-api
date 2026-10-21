const CARD_TYPE_PROMPTS = {
  educational:
    'Discovery style — each slide reveals something the reader likely never knew. Goal: "ого, я этого не знал!" Mix surprising facts with brief explanations.',
  learning:
    'Teaching style — explain concepts clearly, build understanding step by step, use simple examples and definitions.',
  wow: 'Maximum wow — shocking stats, counterintuitive truths, myth vs reality, mind-blowing facts on every slide.',
  'how-to':
    'How-to style — practical step-by-step instructions the reader can apply immediately. Number steps where helpful.',
  listicle: 'Listicle style — numbered tips, rules, or items. Crisp, scannable, one clear point per slide.',
  'myth-bust': 'Myth-busting — state a common belief, then reveal the truth with evidence or logic.',
  story: 'Storytelling — mini-stories, scenarios, or narrative examples that make each point memorable.',
  motivation: 'Motivational — inspiring reframes, empowering language, energy and confidence (still grounded, not cheesy).',
  insights: 'Insight style — non-obvious shortcuts, smart angles, actionable aha-moments.',
  'do-better': 'Improvement style — optimize habits, fix mistakes, do everyday things smarter and faster.',
};

const CATEGORY_PROMPTS = {
  any: '',
  it: 'IT, software, AI, cybersecurity, gadgets — surprising tech facts and practical digital tips.',
  psychology: 'psychology, mindset, habits, cognitive biases, emotions, behavior.',
  'self-worth': 'self-worth, confidence, boundaries, self-respect, inner critic, personal growth.',
  productivity: 'productivity, focus, time management, deep work, energy.',
  career: 'career, leadership, interviews, salary, workplace skills.',
  health: 'health, sleep, body, wellness, longevity — evidence-based surprises.',
  finance: 'money, investing, saving, financial literacy, economic myths.',
  learning: 'learning, memory, study techniques, skill acquisition.',
  security: 'digital and personal safety, scams, privacy, fraud prevention.',
  creativity: 'creativity, ideas, writing, design thinking, innovation.',
  relationships: 'communication, relationships, conflict, empathy, social skills.',
  science: 'science, nature, physics, biology, space — fascinating facts.',
  history: 'history, culture, forgotten events, historical what-ifs.',
  food: 'food, cooking, nutrition myths, lifestyle, everyday hacks.',
  travel: 'travel, local culture, places to visit, regional food, geography, visitor tips.',
};

const LANG_NAMES = {
  ru: 'Russian (русский)',
  en: 'English',
  he: 'Hebrew (עברית)',
  uk: 'Ukrainian (українська)',
  de: 'German (Deutsch)',
  fr: 'French (français)',
  es: 'Spanish (español)',
};

export function cardTypePromptHint(cardTypeId) {
  return CARD_TYPE_PROMPTS[cardTypeId] ?? CARD_TYPE_PROMPTS.educational;
}

export function categoryPromptHint(categoryId) {
  return CATEGORY_PROMPTS[categoryId] ?? '';
}

export function languagePromptName(language) {
  return LANG_NAMES[language] ?? LANG_NAMES.en;
}

export function buildSystemPrompt(language, slideCount, cardTypeId) {
  const langName = languagePromptName(language);
  const styleHint = cardTypePromptHint(cardTypeId);

  return `You are an expert at viral educational carousel cards (Instagram / Reels).
Create an engaging topic with EXACTLY ${slideCount} slides (no more, no fewer).

LANGUAGE (critical):
- Write ALL user-facing text in ${langName}: category, slide titles, content, quotes, readTime labels.
- imageQuery must ALWAYS be 2–6 English keywords for stock photo search (never translate imageQuery).
- imageQuery must visually match slide 1 and the topic (finance → money investment, travel → city landmark, etc.).

CARD STYLE (critical — follow this tone and structure):
${styleHint}

QUALITY:
- Open slide 1 with a scroll-stopping hook matched to the card style.
- Prefer concrete specifics: numbers, dates, studies, examples — not vague advice.
- One clear point per slide; short paragraphs, no filler.
- Quotes = screenshot-worthy punchlines when appropriate.
- HTML tags <b>, <i>, <br> allowed in content — bold key facts or numbers.
- accentColor — bright hex (#rrggbb) for UI.

JSON:
{
  "category": "Short category",
  "bgGradient": "radial-gradient(...)",
  "accentColor": "#ec4899",
  "imageQuery": "focus productivity workspace",
  "slides": [
    {
      "title": "Title",
      "content": "Text with <b>formatting</b>",
      "quote": "Takeaway",
      "readTime": "1 min"
    }
  ]
}`;
}

export function maxOutputTokensFor(slideCount) {
  if (slideCount >= 20) return 16_384;
  if (slideCount >= 15) return 12_288;
  if (slideCount >= 10) return 10_240;
  return 8192;
}
