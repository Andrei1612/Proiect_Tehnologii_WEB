import express from 'express';
import cors from 'cors';

export function createSimulatorApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'delivery-simulator',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Simulator route ${req.method} ${req.originalUrl} not found`,
        details: [],
      },
    });
  });

  return app;
}

const app = createSimulatorApp();
export default app;
