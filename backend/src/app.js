import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  const healthHandler = (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'marketplace-backend',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        details: [],
      },
    });
  });

  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message =
      statusCode >= 500 ? 'Internal server error' : err.message || 'Request failed';

    res.status(statusCode).json({
      error: {
        code,
        message,
        details: Array.isArray(err.details) ? err.details : [],
      },
    });
  });

  return app;
}

const app = createApp();
export default app;
