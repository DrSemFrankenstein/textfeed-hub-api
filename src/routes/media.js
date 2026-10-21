import { Router } from 'express';
import { loadEnv } from '../config/env.js';
import { resolvePixabayPhotoMedia } from '../media/pixabayResolve.js';
import { fetchPixabayImageById, searchCoverWithFallback } from '../media/searchCover.js';

const PROXY_IMAGE_HOSTS = new Set(['cdn.pixabay.com', 'images.unsplash.com', 'plus.unsplash.com']);

function isAllowedProxyImageUrl(raw) {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol !== 'https:') return false;
    return PROXY_IMAGE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function createMediaRouter() {
  const router = Router();

  router.get('/proxy', async (req, res, next) => {
    try {
      const target = String(req.query.url || '');
      if (!isAllowedProxyImageUrl(target)) {
        return res.status(400).json({ error: 'URL not allowed' });
      }

      const upstream = await fetch(target, {
        redirect: 'follow',
        headers: {
          Accept: 'image/*,video/*,*/*;q=0.8',
          'User-Agent': 'InfoFeed-Hub/1.0',
        },
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
      }

      let contentType = upstream.headers.get('content-type') || '';
      const pathLower = new URL(target).pathname.toLowerCase();
      if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
        if (pathLower.endsWith('.mp4')) contentType = 'video/mp4';
        else if (pathLower.endsWith('.webm')) contentType = 'video/webm';
        else if (pathLower.endsWith('.jpg') || pathLower.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (pathLower.endsWith('.png')) contentType = 'image/png';
        else if (pathLower.endsWith('.webp')) contentType = 'image/webp';
        else return res.status(415).json({ error: 'Unsupported media type' });
      }

      res.setHeader('Content-Type', contentType.split(';')[0].trim());
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const body = Buffer.from(await upstream.arrayBuffer());
      res.send(body);
    } catch (e) {
      next(e);
    }
  });

  router.get('/pixabay-resolve', async (req, res, next) => {
    try {
      const pageUrl = String(req.query.pageUrl || '').trim();
      const pixabayId = String(req.query.pixabayId || '').replace(/\D/g, '');
      if (!pageUrl && !pixabayId) {
        return res.status(400).json({ error: 'pageUrl or pixabayId required' });
      }
      const { pixabayApiKey } = loadEnv();
      const media = await resolvePixabayPhotoMedia({
        pageUrl,
        pixabayId,
        apiKey: pixabayApiKey,
      });
      res.json({ media });
    } catch (e) {
      next(e);
    }
  });

  router.get('/config', (_req, res) => {
    const { pixabayApiKey, unsplashAccessKey } = loadEnv();
    res.json({
      serverPixabay: Boolean(pixabayApiKey?.trim()),
      serverUnsplash: Boolean(unsplashAccessKey?.trim()),
    });
  });

  router.post('/cover', async (req, res, next) => {
    try {
      const { pixabayApiKey, unsplashAccessKey } = loadEnv();
      const keys = {
        pixabay: pixabayApiKey?.trim() || '',
        unsplash: unsplashAccessKey?.trim() || '',
      };
      if (!keys.pixabay && !keys.unsplash) {
        return res.status(503).json({ error: 'No PIXABAY_API_KEY or UNSPLASH_ACCESS_KEY on server' });
      }

      const pixabayId = String(req.body?.pixabayId || '').replace(/\D/g, '');
      if (pixabayId) {
        if (!keys.pixabay) {
          return res.status(503).json({ error: 'No PIXABAY_API_KEY on server' });
        }
        const media = await fetchPixabayImageById(pixabayId, keys.pixabay);
        return res.json({ media });
      }

      const query = String(req.body?.query || '').trim();
      if (!query) return res.status(400).json({ error: 'query or pixabayId required' });

      const provider = req.body?.provider === 'unsplash' ? 'unsplash' : 'pixabay';
      const mediaType = req.body?.mediaType === 'video' ? 'video' : 'image';

      const media = await searchCoverWithFallback(query, { provider, mediaType }, keys);
      res.json({ media });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
