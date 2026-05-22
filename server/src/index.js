import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the repo root (one level above server/), with a fallback to server/.env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const express = (await import('express')).default;
const cors = (await import('cors')).default;
const { default: routes } = await import('./routes.js');
const { signeasyFetch } = await import('./signeasy.js');
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', routes);

// Optionally serve the built React app in production.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).end();
  });
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  // Drill into fetch's wrapped cause so the browser can see why a network call failed.
  let detail = err.message || 'Internal Server Error';
  if (err.cause) {
    const cause = err.cause;
    const causeMsg = cause.message || cause.code || String(cause);
    detail = `${detail} — ${causeMsg}`;
    if (Array.isArray(cause.errors) && cause.errors.length) {
      detail += ` (${cause.errors.map((e) => e.message || e.code).join('; ')})`;
    }
  }
  res.status(status).json({ error: detail });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, async () => {
  console.log(`[server] listening on http://localhost:${port}`);
  if (!process.env.SIGNEASY_CLIENT_ID || !process.env.SIGNEASY_CLIENT_SECRET) {
    console.warn(
      '[server] WARNING: SIGNEASY_CLIENT_ID / SIGNEASY_CLIENT_SECRET are not set. ' +
        'Copy .env.example to .env and fill them in before making API calls.'
    );
    return;
  }
  // Startup probe: do a token exchange + /me lookup so misconfigurations surface immediately.
  try {
    const meRes = await signeasyFetch('/me');
    if (meRes.ok) {
      console.log(`[server] Signeasy credentials OK (GET /v3/me returned ${meRes.status})`);
    } else {
      const text = await meRes.text();
      console.warn(`[server] Signeasy /me probe returned ${meRes.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.warn(`[server] Signeasy startup probe failed: ${err.message}`);
  }
});
