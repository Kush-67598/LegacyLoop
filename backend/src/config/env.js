import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(backendDirectory, '.env') });

const port = Number.parseInt(process.env.PORT ?? '4000', 10);
const stalePrDays = Number.parseInt(process.env.STALE_PR_DAYS ?? '14', 10);
if (!Number.isInteger(stalePrDays) || stalePrDays < 1 || stalePrDays > 3650) throw new Error('STALE_PR_DAYS must be an integer from 1 to 3650');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development', port,
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/legacyloop',
  stalePrDays,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000'
});

export function getGeminiConfig() {
  return Object.freeze({
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'
  });
}
