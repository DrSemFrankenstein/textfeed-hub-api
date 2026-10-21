import { Router } from 'express';
import { FeedTopic } from '../models/FeedTopic.js';
import { recordCategoryView } from '../models/UserPreference.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function toClientTopic(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    category: o.category,
    categoryId: o.categoryId,
    cardTypeId: o.cardTypeId,
    bgGradient: o.bgGradient,
    accentColor: o.accentColor,
    imageUrl: o.imageUrl,
    videoUrl: o.videoUrl,
    coverThumbUrl: o.coverThumbUrl,
    coverMediaType: o.coverMediaType,
    mediaProvider: o.mediaProvider,
    imageCredit: o.imageCredit,
    imageCreditUrl: o.imageCreditUrl,
    imageQuery: o.imageQuery,
    coverObjectFit: o.coverObjectFit,
    likes: o.likes ?? 0,
    slides: o.slides ?? [],
    comments: o.comments ?? [],
    authorUserId: o.authorUserId,
    createdAt: o.createdAt,
  };
}

function stripClientOnly(body) {
  const {
    id: _id,
    _id: __id,
    liked: _l,
    saved: _s,
    activeSlide: _a,
    showHeartAnim: _h,
    ...rest
  } = body;
  return rest;
}

export function createFeedsRouter() {
  const router = Router();

  router.get(
    '/',
    async (req, res, next) => {
      try {
        const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));
        const cursor = String(req.query.cursor || '').trim();
        const userId = String(req.query.userId || '').trim();

        const filter = {};
        if (cursor) {
          const [createdAt, id] = cursor.split('|');
          if (createdAt && id) {
            filter.$or = [
              { createdAt: { $gt: new Date(createdAt) } },
              { createdAt: new Date(createdAt), _id: { $gt: id } },
            ];
          }
        }

        // Chronological append order; userId reserved for future ranked slices.
        void userId;

        const items = await FeedTopic.find(filter).sort({ createdAt: 1, _id: 1 }).limit(limit).lean();
        const last = items[items.length - 1];
        const nextCursor =
          items.length === limit && last
            ? `${new Date(last.createdAt).toISOString()}|${last._id}`
            : null;

        res.json({
          items: items.map((d) => toClientTopic(d)),
          nextCursor,
        });
      } catch (e) {
        next(e);
      }
    },
  );

  router.post('/', async (req, res, next) => {
    try {
      const payload = stripClientOnly(req.body?.topic ?? req.body);
      if (!Array.isArray(payload.slides) || payload.slides.length === 0) {
        return res.status(400).json({ error: 'Topic must include slides' });
      }
      const doc = await FeedTopic.create({
        ...payload,
        authorUserId: req.body?.authorUserId || payload.authorUserId || 'anonymous',
      });
      res.status(201).json({ topic: toClientTopic(doc) });
    } catch (e) {
      next(e);
    }
  });

  router.post('/events/view', async (req, res, next) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      const categoryId = String(req.body?.categoryId || 'any').trim();
      if (!userId) return res.status(400).json({ error: 'userId required' });
      await recordCategoryView(userId, categoryId, Number(req.body?.weight) || 1);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.get('/stats', async (_req, res, next) => {
    try {
      const count = await FeedTopic.countDocuments();
      res.json({ count });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
