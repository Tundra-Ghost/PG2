import { createAccounts } from './accounts';
import { createGameServer } from './server';
import { FileStore } from './store';

const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://127.0.0.1:5173'];

// DATA_DIR is a Fly volume in production, so games survive sleep and deploys.
const store = process.env.DATA_DIR ? new FileStore(process.env.DATA_DIR) : undefined;

// DB_PATH is a SQLite file on the same volume. Locally, accounts live in memory.
const secret = process.env.BETTER_AUTH_SECRET;
if (process.env.DB_PATH && !secret) throw new Error('BETTER_AUTH_SECRET must be set when DB_PATH is.');
const accounts = await createAccounts({
  dbPath: process.env.DB_PATH ?? ':memory:',
  secret: secret ?? 'local-dev-secret-not-for-production-use',
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
  trustedOrigins: corsOrigin,
});

const { app } = createGameServer({ corsOrigin, logger: true, store, accounts });
app.addHook('onClose', async () => accounts.close());
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
