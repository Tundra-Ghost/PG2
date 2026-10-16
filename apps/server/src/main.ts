import { createGameServer } from './server';
import { FileStore } from './store';

const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://127.0.0.1:5173'];

// DATA_DIR is a Fly volume in production, so games survive sleep and deploys.
const store = process.env.DATA_DIR ? new FileStore(process.env.DATA_DIR) : undefined;

const { app } = createGameServer({ corsOrigin, logger: true, store });
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
