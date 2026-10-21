import { stablePixabayImageFromHit, stablePixabayThumbFromHit } from './pixabayStableUrl.js';

const PIXABAY_PER_PAGE_MIN = 3;
const PIXABAY_PER_PAGE_MAX = 200;
const UNSPLASH_HOME = 'https://unsplash.com/?utm_source=infofeed&utm_medium=referral';
const PIXABAY_HOME = 'https://pixabay.com/';

function clampPixabayPerPage(perPage) {
  return Math.min(PIXABAY_PER_PAGE_MAX, Math.max(PIXABAY_PER_PAGE_MIN, perPage));
}

function englishQuery(value) {
  return value
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[^a-zA-Z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');
}

export function mediaSearchQuery(raw, provider) {
  const trimmed = String(raw).replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'abstract background';
  const english = englishQuery(trimmed);
  if (provider === 'unsplash') {
    return english.length >= 2 ? english : 'abstract background';
  }
  return english.length >= 2 ? english : trimmed;
}

function withUtm(url) {
  if (!url) return UNSPLASH_HOME;
  return url.includes('?') ? `${url}&utm_source=infofeed&utm_medium=referral` : `${url}?utm_source=infofeed&utm_medium=referral`;
}

const RELEVANT_IMAGE_RESULTS = 10;
const RELEVANT_VIDEO_RESULTS = 5;

function relevanceScore(query, haystack) {
  const words = mediaSearchQuery(query, 'pixabay')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const hay = String(haystack || '').toLowerCase();
  return words.reduce((score, word) => score + (hay.includes(word) ? 1 : 0), 0);
}

function pickMostRelevant(items, query, describe) {
  if (!items?.length) return null;
  let best = items[0];
  let bestScore = relevanceScore(query, describe(best));
  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const score = relevanceScore(query, describe(item));
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

function relevantCoverPlans(preferred) {
  const altProvider = preferred.provider === 'pixabay' ? 'unsplash' : 'pixabay';
  if (preferred.mediaType === 'video') {
    return [preferred, { provider: 'pixabay', mediaType: 'video' }];
  }
  return [preferred, { provider: altProvider, mediaType: 'image' }, { provider: preferred.provider, mediaType: 'image' }];
}

function parseUnsplashPhoto(photo) {
  if (!photo?.id || !photo.urls?.regular) return null;
  const name = photo.user?.name?.trim();
  const username = photo.user?.username?.trim();
  const profile = username ? `https://unsplash.com/@${username}` : photo.user?.links?.html;
  const imageUrl = photo.urls.regular;
  const thumbUrl = photo.urls.small || photo.urls.thumb || imageUrl;
  return {
    id: photo.id,
    mediaType: 'image',
    provider: 'unsplash',
    imageUrl,
    thumbUrl,
    credit: name || username || 'Unsplash',
    creditUrl: withUtm(profile || UNSPLASH_HOME),
  };
}

async function fetchUnsplashSearch(query, key, page, perPage) {
  const apiKey = key.trim();
  const q = mediaSearchQuery(query, 'unsplash');
  if (!apiKey || !q) return [];

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}&orientation=portrait`,
    { headers: { Authorization: `Client-ID ${apiKey}`, 'Accept-Version': 'v1' } },
  );

  if (!response.ok) {
    throw new Error(`Unsplash error ${response.status}`);
  }

  const body = await response.json();
  const photos = body.results ?? [];
  if (photos.length === 0) return [];
  const best =
    perPage > 1
      ? pickMostRelevant(photos, query, (p) =>
          [p.alt_description, p.description, p.user?.name].filter(Boolean).join(' '),
        )
      : photos[0];
  if (!best) return [];
  const parsed = parseUnsplashPhoto(best);
  return parsed ? [parsed] : [];
}

export async function fetchPixabayImageById(id, apiKey) {
  const key = String(apiKey || '').trim();
  const photoId = String(id || '').replace(/\D/g, '');
  if (!key || !photoId) return null;

  const response = await fetch(
    `https://pixabay.com/api/?key=${encodeURIComponent(key)}&id=${encodeURIComponent(photoId)}`,
  );
  if (!response.ok) throw new Error(`Pixabay error ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error);
  const hit = body.hits?.[0];
  if (!hit) return null;

  const imageUrl = stablePixabayImageFromHit(hit);
  const thumbUrl = stablePixabayThumbFromHit(hit, imageUrl);
  if (!imageUrl) return null;

  return {
    id: String(hit.id),
    mediaType: 'image',
    provider: 'pixabay',
    imageUrl,
    thumbUrl,
    credit: hit.user || 'Pixabay',
    creditUrl: hit.pageURL || PIXABAY_HOME,
  };
}

async function fetchPixabayImages(query, key, page, perPage) {
  const apiKey = key.trim();
  const q = mediaSearchQuery(query, 'pixabay');
  if (!apiKey || !q) return [];

  const safePerPage = clampPixabayPerPage(perPage);
  const response = await fetch(
    `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&image_type=photo&orientation=vertical&safesearch=true&per_page=${safePerPage}&page=${page}`,
  );

  if (!response.ok) throw new Error(`Pixabay error ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error);

  const hits = body.hits ?? [];
  if (hits.length === 0) return [];
  const best =
    perPage > 1 ? pickMostRelevant(hits, query, (hit) => hit.tags || hit.user || '') : hits[0];
  if (!best) return [];
  const imageUrl = stablePixabayImageFromHit(best);
  const thumbUrl = stablePixabayThumbFromHit(best, imageUrl);
  if (!imageUrl) return [];
  return [
    {
      id: String(best.id),
      mediaType: 'image',
      provider: 'pixabay',
      imageUrl,
      thumbUrl,
      credit: best.user || 'Pixabay',
      creditUrl: best.pageURL || PIXABAY_HOME,
    },
  ];
}

async function fetchPixabayVideos(query, key, page, perPage) {
  const apiKey = key.trim();
  const q = mediaSearchQuery(query, 'pixabay');
  if (!apiKey || !q) return [];

  const safePerPage = clampPixabayPerPage(perPage);
  const response = await fetch(
    `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&safesearch=true&per_page=${safePerPage}&page=${page}`,
  );

  if (!response.ok) throw new Error(`Pixabay error ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error);

  const hits = body.hits ?? [];
  if (hits.length === 0) return [];
  const best = perPage > 1 ? pickMostRelevant(hits, query, (hit) => hit.tags || hit.user || '') : hits[0];
  const items = [];
  for (const hit of hits) {
    const rendition = hit.videos?.medium || hit.videos?.small || hit.videos?.large || hit.videos?.tiny;
    const videoUrl = rendition?.url;
    if (!videoUrl) continue;
    items.push({
      id: String(hit.id),
      mediaType: 'video',
      provider: 'pixabay',
      videoUrl,
      thumbUrl: rendition?.thumbnail,
      credit: hit.user || 'Pixabay',
      creditUrl: hit.pageURL || PIXABAY_HOME,
    });
  }
  if (!best) return items;
  const bestId = String(best.id);
  items.sort((a, b) => (a.id === bestId ? -1 : b.id === bestId ? 1 : 0));
  return items;
}

async function searchOne(query, provider, mediaType, keys) {
  const apiKey = provider === 'pixabay' ? keys.pixabay : keys.unsplash;
  if (!apiKey?.trim()) return null;
  const perPage = mediaType === 'video' ? RELEVANT_VIDEO_RESULTS : RELEVANT_IMAGE_RESULTS;
  const results =
    provider === 'pixabay'
      ? mediaType === 'video'
        ? await fetchPixabayVideos(query, apiKey, 1, perPage)
        : await fetchPixabayImages(query, apiKey, 1, perPage)
      : await fetchUnsplashSearch(query, apiKey, 1, perPage);
  return results[0] ?? null;
}

/** @param {{ unsplash?: string; pixabay?: string }} keys */
export async function searchCoverWithFallback(query, preferred, keys) {
  const plans = relevantCoverPlans(preferred);
  const seen = new Set();
  for (const plan of plans) {
    const key = `${plan.provider}:${plan.mediaType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const media = await searchOne(query, plan.provider, plan.mediaType, keys);
      if (media) return media;
    } catch {
      // next source
    }
  }
  return null;
}
