import 'dotenv/config';
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
