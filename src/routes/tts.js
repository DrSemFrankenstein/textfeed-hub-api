import { Router } from 'express';
import { loadEnv } from '../config/env.js';

const GEMINI_TTS_STREAM_MODEL = 'gemini-3.1-flash-tts-preview';
const GEMINI_TTS_BATCH_MODEL = 'gemini-2.5-flash-preview-tts';
const VOICE = 'Kore';

function ttsBody(text) {
  return {
    contents: [{ parts: [{ text }] }],
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  };
}

export function createTtsRouter() {
  const router = Router();

  router.get('/config', (_req, res) => {
    const { geminiApiKey } = loadEnv();
    res.json({ serverTts: Boolean(geminiApiKey?.trim()) });
  });

  router.post('/stream', async (req, res, next) => {
    try {
      const { geminiApiKey } = loadEnv();
      if (!geminiApiKey?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
      }
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: 'text required' });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_TTS_STREAM_MODEL)}:streamGenerateContent?alt=sse`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey.trim(),
        },
        body: JSON.stringify(ttsBody(text)),
      });

      if (!upstream.ok) {
        const data = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json({ error: data.error?.message || 'TTS upstream failed' });
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstream.body?.getReader();
      if (!reader) {
        return res.status(502).json({ error: 'No stream body' });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(value);
      }
      res.end();
    } catch (e) {
      next(e);
    }
  });

  router.post('/batch', async (req, res, next) => {
    try {
      const { geminiApiKey } = loadEnv();
      if (!geminiApiKey?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
      }
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: 'text required' });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_TTS_BATCH_MODEL)}:generateContent`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey.trim(),
        },
        body: JSON.stringify(ttsBody(text)),
      });
      const data = await upstream.json();
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: data.error?.message || 'TTS batch failed' });
      }
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
