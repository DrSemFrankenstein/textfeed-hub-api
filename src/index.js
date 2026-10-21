import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirnameBootstrap = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirnameBootstrap, '../../../../..');

const MONOREPO_ENV_KEYS = ['PIXABAY_API_KEY', 'UNSPLASH_ACCESS_KEY', 'GEMINI_API_KEY'];

function applyMonorepoEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    for (const key of MONOREPO_ENV_KEYS) {
      if (!process.env[key]?.trim() && parsed[key]?.trim()) {
        process.env[key] = parsed[key].trim();
      }
    }
  } catch {
    // ignore missing/unreadable env files
  }
}

dotenv.config({ path: path.resolve(__dirnameBootstrap, '../.env') });
applyMonorepoEnvFile(path.join(monorepoRoot, 'MCP', '.env'));
applyMonorepoEnvFile(path.join(monorepoRoot, 'shared-platform', '.env'));
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { loadEnv } from './config/env.js';
import { connectMongo, mongoStatus } from './config/mongo.js';
import { createFeedsRouter } from './routes/feeds.js';
import { createGenerateRouter } from './routes/generate.js';
import { createMediaRouter } from './routes/media.js';
import { createTtsRouter } from './routes/tts.js';

const __dirname = __dirnameBootstrap;
const { port: PORT } = loadEnv();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  const mongo = mongoStatus();
  const { geminiApiKey } = loadEnv();
  res.json({
    status: 'ok',
    service: 'textfeed-hub',
    mongo: mongo.connected ? 'connected' : 'disconnected',
    db: mongo.db,
    collections: ['feedtopics', 'userpreferences'],
    serverGemini: Boolean(geminiApiKey?.trim()),
    serverPixabay: Boolean(loadEnv().pixabayApiKey?.trim()),
    serverUnsplash: Boolean(loadEnv().unsplashAccessKey?.trim()),
  });
});

app.use('/api/feeds', createFeedsRouter());
app.use('/api/generate', createGenerateRouter());
app.use('/api/media', createMediaRouter());
app.use('/api/tts', createTtsRouter());

const clientDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

async function main() {
  await connectMongo();
  const { geminiApiKey } = loadEnv();
  if (!geminiApiKey?.trim()) {
    console.warn('[gemini] GEMINI_API_KEY missing — auto-feed will not run until backend/.env is set');
  } else {
    console.log('[gemini] server generation enabled');
  }

  app.listen(PORT, () => {
    console.log(`[textfeed-hub] http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
