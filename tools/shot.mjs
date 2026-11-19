// Screenshot SOLARA BAY: 4 scene via Playwright + SwiftShader.
// Verifikasi /tmp/webgl-policy.txt dulu, serve via node serve.ts (:8080).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright');

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POLICY = '/tmp/webgl-policy.txt';
const POLICY_BODY = 'hatch-webgl-allowed-domains-v1\nsolarabay.game\n';
const POLICY_SHA = '7bb678df967ebb65e8b80fd6869d629166db1ea7006957942fadb62a109f109d';

async function checkPolicy() {
  let body = '';
  try { body = await readFile(POLICY, 'utf8'); } catch (_) { /* hilang */ }
  const sha = createHash('sha256').update(body).digest('hex');
  if (body !== POLICY_BODY || sha !== POLICY_SHA) {
    await writeFile(POLICY, POLICY_BODY);
    const sha2 = createHash('sha256').update(await readFile(POLICY, 'utf8')).digest('hex');
    if (sha2 !== POLICY_SHA) throw new Error('webgl policy sha mismatch: ' + sha2);
    console.log('webgl-policy.txt recreated + sha256 OK');
  } else console.log('webgl-policy.txt OK (sha256 ' + sha.slice(0, 12) + '…)');
}

async function waitPort(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch (_) { /* belum */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const shots = JSON.parse(await readFile(path.join(REPO, 'shots.json'), 'utf8')).shots;
await checkPolicy();

const server = spawn('node', ['serve.ts'], { cwd: REPO, stdio: 'pipe' });
server.stdout.on('data', (d) => process.stdout.write('[serve] ' + d));
server.stderr.on('data', (d) => process.stderr.write('[serve:err] ' + d));
const up = await waitPort('http://localhost:8080/game/');
if (!up) { server.kill(); throw new Error('serve.ts tidak naik di :8080'); }

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: [
    '--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    '--hatch-webgl-allowed-domains-sha256=' + POLICY_SHA,
  ],
  env: { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', no_proxy: '*' },
});
// Chromium build ini memblokir navigasi ke localhost (LNA checks) —
// sajikan game lewat host solarabay.game (ada di webgl policy) dgn
// page.route yang mengambil konten dari serve.ts :8080 lewat Node fetch.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
async function routeGame(page) {
  await page.route('**/solarabay.game/**', async (route) => {
    const u = new URL(route.request().url());
    let p = u.pathname;
    if (p.endsWith('/')) p += 'index.html';
    const r = await fetch('http://localhost:8080' + p + u.search);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = p.slice(p.lastIndexOf('.'));
    await route.fulfill({ status: r.status, contentType: MIME[ext] || 'application/octet-stream', body: buf });
  });
}
let failures = 0;
try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await routeGame(page);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url()));
    const url = 'http://solarabay.game/game/' + shot.query;
    console.log('>> ' + shot.name + '  ' + url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForFunction(() => window.__shotReady === true, { timeout: 240000 });
    } catch (_) {
      const g = await page.evaluate(() => window.__game || null).catch(() => null);
      errors.push('TIMEOUT __shotReady; __game=' + JSON.stringify(g));
    }
    await page.waitForTimeout(1500);
    const out = path.join(REPO, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
    const size = (await stat(out)).size;
    const g = await page.evaluate(() => window.__game || null).catch(() => null);
    console.log('   ' + shot.name + ' ' + size + ' bytes  errors=' + errors.length + '  game=' + JSON.stringify(g));
    if (errors.length) { failures++; errors.forEach((e) => console.log('   ERR ' + e)); }
    if (size > 256 * 1024) { failures++; console.log('   ERR size > 256 KiB'); }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failures === 0 ? 'SHOT OK — 0 error' : 'SHOT FAIL — ' + failures + ' masalah');
process.exit(failures === 0 ? 0 : 1);
