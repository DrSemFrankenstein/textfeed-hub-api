import { fetchPixabayImageById } from './searchCover.js';

const PIXABAY_HOME = 'https://pixabay.com/';

export function pixabayPhotoIdFromPageUrl(url) {
  if (!url?.trim()) return null;
  const match = String(url).match(/pixabay\.com\/photos\/[^/?#]+-(\d+)\/?/i);
  return match?.[1] ?? null;
}

export function isPixabayPhotoPageUrl(url) {
  try {
    const u = new URL(String(url || ''));
    return u.hostname.replace(/^www\./, '') === 'pixabay.com' && u.pathname.startsWith('/photos/');
  } catch {
    return false;
  }
}

function thumbFromLarge(cdnUrl) {
  return String(cdnUrl).replace(/_1280(\.[a-z]+)$/i, '_640$1').replace(/_960(\.[a-z]+)$/i, '_640$1');
}

async function scrapePixabayCdnFromPage(pageUrl) {
  const res = await fetch(pageUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; InfoFeed-Hub/1.0)',
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const patterns = [
    /property=["']og:image:secure_url["']\s+content=["'](https:\/\/cdn\.pixabay\.com[^"']+)["']/i,
    /property=["']og:image["']\s+content=["'](https:\/\/cdn\.pixabay\.com[^"']+)["']/i,
    /content=["'](https:\/\/cdn\.pixabay\.com\/photo\/[^"']+)["']\s+property=["']og:image/i,
    /"(https:\/\/cdn\.pixabay\.com\/photo\/[^"]+\.(?:jpg|jpeg|png|webp))"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      return m[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
    }
  }
  return null;
}

/** Resolve Pixabay photo page or id → stable cdn.pixabay.com URLs. */
export async function resolvePixabayPhotoMedia({ pageUrl, pixabayId, apiKey }) {
  const id =
    String(pixabayId || '')
      .replace(/\D/g, '')
      .trim() || pixabayPhotoIdFromPageUrl(pageUrl);

  let page = String(pageUrl || '').trim();
  if (!page && id) {
    page = `https://pixabay.com/photos/photo-${id}/`;
  }

  const key = String(apiKey || '').trim();
  if (key && id) {
    try {
      const fromApi = await fetchPixabayImageById(id, key);
      if (fromApi?.imageUrl) return fromApi;
    } catch {
      // scrape fallback
    }
  }

  if (page && isPixabayPhotoPageUrl(page)) {
    const cdn = await scrapePixabayCdnFromPage(page);
    if (cdn) {
      return {
        id: id || 'pixabay',
        mediaType: 'image',
        provider: 'pixabay',
        imageUrl: cdn,
        thumbUrl: thumbFromLarge(cdn),
        credit: 'Pixabay',
        creditUrl: page,
      };
    }
  }

  return null;
}
