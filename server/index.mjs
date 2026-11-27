// Start the game server: npm run server  (PORT, HOST, ALLOW_ORIGINS, DATA_DIR and ADMIN_TOKEN from the environment).
import { startGameServer } from './GameServer.mjs';

const origins = process.env.ALLOW_ORIGINS ? process.env.ALLOW_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean) : null;
const server = await startGameServer({ port: Number(process.env.PORT ?? 8787), host: process.env.HOST ?? '0.0.0.0', allowOrigins: origins,
  dataDir: process.env.DATA_DIR || null, adminToken: process.env.ADMIN_TOKEN || null, firebaseProjectId: process.env.FIREBASE_PROJECT_ID || null });
const stop = () => server.close().then(() => process.exit(0));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
