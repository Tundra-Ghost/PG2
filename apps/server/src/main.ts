import { createGameServer } from './server';

const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://127.0.0.1:5173'];

const { app } = createGameServer({ corsOrigin, logger: true });
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
