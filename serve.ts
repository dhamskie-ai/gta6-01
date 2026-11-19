// Server statis SOLARA BAY: sajikan game/ di http://localhost:8080.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
const root = resolve(import.meta.dirname, 'game');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};
const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost:8080');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  const file = join(root, rel);
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
server.listen(8080, () => console.log('SOLARA BAY di http://localhost:8080'));
