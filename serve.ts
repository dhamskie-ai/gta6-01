// SOLARA BAY — tiny static server for local playtests.
// Serves the repo root on http://localhost:8080; `/` maps to `/game/`.
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/game/';
    if (rel.endsWith('/')) rel += 'index.html';
    const full = path.normalize(path.join(ROOT, rel));
    if (!full.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      res.writeHead(404); res.end('not found: ' + rel); return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  } catch (err) {
    res.writeHead(500); res.end('server error');
  }
});

server.listen(PORT, () => {
  console.log(`SOLARA BAY serving ${ROOT} at http://localhost:${PORT}/`);
});
