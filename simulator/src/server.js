import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import app from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(repoRoot, '.env') });

const port = Number(process.env.SIMULATOR_PORT || 4001);

const server = app.listen(port, () => {
  console.log(`[delivery-simulator] Listening on http://localhost:${port}`);
});

export default server;
