import { Router } from 'express';
import { loadEnv } from '../config/env.js';
import { generateFromPromptPayload, generateSurprisePayload } from '../gemini/generate.js';
import { exploreChatReply, exploreFeedPayload } from '../gemini/explore.js';

const SLIDE_COUNTS = new Set([5, 10, 15, 20]);

export function createGenerateRouter() {
  const router = Router();

  router.get('/config', (_req, res) => {
    const { geminiApiKey, pixabayApiKey, unsplashAccessKey } = loadEnv();
    res.json({
      serverGemini: Boolean(geminiApiKey?.trim()),
      serverPixabay: Boolean(pixabayApiKey?.trim()),
      serverUnsplash: Boolean(unsplashAccessKey?.trim()),
    });
  });

  router.post('/surprise', async (req, res, next) => {
    try {
      const { geminiApiKey, geminiModel } = loadEnv();
      if (!geminiApiKey?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
      }
      const slideCount = Number(req.body?.slideCount) || 5;
      if (!SLIDE_COUNTS.has(slideCount)) {
        return res.status(400).json({ error: 'Invalid slideCount' });
      }
      const language = String(req.body?.language || 'ru').slice(0, 8);
      const categoryId = String(req.body?.categoryId || 'any').slice(0, 40);
      const cardTypeId = String(req.body?.cardTypeId || 'educational').slice(0, 40);

      const payload = await generateSurprisePayload(geminiApiKey, {
        language,
        slideCount,
        categoryId,
        cardTypeId,
        model: geminiModel,
      });
      res.json({ payload });
    } catch (e) {
      next(e);
    }
  });

  router.post('/topic', async (req, res, next) => {
    try {
      const { geminiApiKey, geminiModel } = loadEnv();
      if (!geminiApiKey?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
      }
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt) return res.status(400).json({ error: 'prompt required' });
      const slideCount = Number(req.body?.slideCount) || 5;
      if (!SLIDE_COUNTS.has(slideCount)) {
        return res.status(400).json({ error: 'Invalid slideCount' });
      }
      const language = String(req.body?.language || 'ru').slice(0, 8);
      const categoryId = String(req.body?.categoryId || 'any').slice(0, 40);
      const cardTypeId = String(req.body?.cardTypeId || 'educational').slice(0, 40);

      const payload = await generateFromPromptPayload(geminiApiKey, {
        language,
        slideCount,
        categoryId,
        cardTypeId,
        prompt,
        model: geminiModel,
      });
      res.json({ payload });
    } catch (e) {
      next(e);
    }
  });

  router.post('/explore/chat', async (req, res, next) => {
    try {
      const { geminiApiKey, geminiModel } = loadEnv();
      if (!geminiApiKey?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
      }
      const language = String(req.body?.language || 'ru').slice(0, 8);
      const location = req.body?.location ?? null;
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const result = await exploreChatReply(geminiApiKey, {
        language,
        location,
        messages,
        model: geminiModel,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post('/explore/feed', async (req, res, next) => {
    try {
      const { geminiApiKey, geminiModel } = loadEnv();
      if (!geminiApiKey?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
      }
      const slideCount = Number(req.body?.slideCount) || 5;
      if (!SLIDE_COUNTS.has(slideCount)) {
        return res.status(400).json({ error: 'Invalid slideCount' });
      }
      const language = String(req.body?.language || 'ru').slice(0, 8);
      const cardTypeId = String(req.body?.cardTypeId || 'educational').slice(0, 40);
      const location = req.body?.location ?? null;
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

      const payload = await exploreFeedPayload(geminiApiKey, {
        language,
        slideCount,
        cardTypeId,
        location,
        messages,
        model: geminiModel,
      });
      res.json({ payload });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
