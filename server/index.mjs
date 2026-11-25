// Start the game server: npm run server  (PORT, HOST and ALLOW_ORIGINS from the environment).
import { startGameServer } from './GameServer.mjs';

const origins = process.env.ALLOW_ORIGINS ? process.env.ALLOW_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean) : null;
const server = await startGameServer({ port: Number(process.env.PORT ?? 8787), host: process.env.HOST ?? '0.0.0.0', allowOrigins: origins });
const stop = () => server.close().then(() => process.exit(0));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
