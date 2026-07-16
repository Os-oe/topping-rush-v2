// Lokaler Prod-ähnlicher Server: dist/ statisch + /api/* auf die Vercel-Handler.
// Playwright-webServer startet ihn via `npm run build && exec node server.js`
// (exec-Pattern: node wird Haupt-PID, sauberer Teardown — MIXR-Lesson).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = process.env.PORT || 4573;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

// Catch-all-API wie auf Vercel: alle /api/*-Routen → eine Function
const apiModule = import('./api/[...path].js');
async function handleApi(req, res) {
  const mod = await apiModule;
  return mod.default(req, res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) return await handleApi(req, res);

    if (pathname === '/board') pathname = '/board.html';
    if (pathname === '/admin') pathname = '/admin.html';
    if (pathname === '/') pathname = '/index.html';

    const file = normalize(join(ROOT, pathname));
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      res.writeHead(404);
      return res.end('not found');
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e?.message || e) }));
  }
});

server.listen(PORT, () => console.log(`topping-rush local server on http://localhost:${PORT}`));
