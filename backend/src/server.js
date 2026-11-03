import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
let server;
async function start() {
  await connectDatabase();
  server = app.listen(env.port, () => console.log(`LegacyLoop API listening on port ${env.port}`));
}
async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase(); process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
start().catch((error) => { console.error('Failed to start LegacyLoop API:', error.message); process.exit(1); });
