/** @typedef {{ mongodbUri: string; mongodbDb: string; port: number; nodeEnv: string; geminiApiKey: string; geminiModel: string; pixabayApiKey: string; unsplashAccessKey: string }} Env */

/** @returns {Env} */
export function loadEnv() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT || 4090),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    mongodbDb: process.env.MONGODB_DB ?? 'textfeed-hub',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
    pixabayApiKey: process.env.PIXABAY_API_KEY ?? '',
    unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY ?? '',
  };
}

/**
 * Legacy MONGO_URI (db in path) — still supported for old .env files.
 * @returns {{ uri: string; dbName?: string } | null}
 */
export function legacyMongoFromEnv() {
  const legacy = process.env.MONGO_URI?.trim();
  if (!legacy) return null;
  return { uri: legacy };
}
