import mongoose from 'mongoose';
import { legacyMongoFromEnv, loadEnv } from './env.js';

export async function connectMongo() {
  const legacy = legacyMongoFromEnv();
  if (legacy) {
    await mongoose.connect(legacy.uri);
    const dbName = mongoose.connection.db?.databaseName ?? '(from URI)';
    console.log(`[mongo] legacy MONGO_URI db=${dbName}`);
    return { dbName, mode: 'legacy' };
  }

  const { mongodbUri, mongodbDb } = loadEnv();
  if (!mongodbUri.trim()) {
    throw new Error('MONGODB_URI is required (or set legacy MONGO_URI)');
  }

  await mongoose.connect(mongodbUri, { dbName: mongodbDb });
  console.log(`[mongo] connected db=${mongodbDb}`);
  return { dbName: mongodbDb, mode: 'shared-platform' };
}

export function mongoStatus() {
  const env = loadEnv();
  return {
    connected: mongoose.connection.readyState === 1,
    db: mongoose.connection.db?.databaseName ?? env.mongodbDb,
  };
}
