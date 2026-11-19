// Server statis SOLARA BAY — sajikan repo di http://localhost:8080.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain',
};
const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
    if (url === '/') url = '/game/';
    if (url.endsWith('/')) url += 'index.html';
    const file = join(ROOT, normalize(url).replace(/^(\.\.[\/\\])+/, ''));
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (_) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});
const PORT = parseInt(process.env.PORT || '8080', 10);
server.listen(PORT, () => console.log('SOLARA BAY on http://localhost:' + PORT + '/game/'));
