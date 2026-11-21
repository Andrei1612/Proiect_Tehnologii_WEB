import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(repoRoot, '.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.BACKEND_PORT || process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseStorage:
    process.env.DATABASE_STORAGE ||
    path.join(repoRoot, 'backend', 'data', 'marketplace.sqlite'),
  databaseTestStorage: process.env.DATABASE_TEST_STORAGE || ':memory:',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-jwt-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  simulatorUrl: process.env.SIMULATOR_URL || 'http://localhost:4001',
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000',
  webhookSecret: process.env.WEBHOOK_SECRET || 'dev-only-webhook-secret-change-me',
  externalTimeoutMs: Number(process.env.EXTERNAL_TIMEOUT_MS || 800),
  externalMaxRetries: Number(process.env.EXTERNAL_MAX_RETRIES || 3),
};
