import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(
    `[marketplace-backend] Listening on http://localhost:${env.port} (${env.nodeEnv})`
  );
});

export default server;
