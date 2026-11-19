// Playtest SOLARA BAY: title → jalan → curi mobil → kendara, 0 error.
// SwiftShader ~2 fps + dt clamp 0,05 → game time ~0,1x real time:
// semua langkah memakai poll-until-condition dgn timeout, bukan sleep tetap.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright');

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POLICY_SHA = '7bb678df967ebb65e8b80fd6869d629166db1ea7006957942fadb62a109f109d';

async function waitPort(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch (_) { /* belum */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const game = (page) => page.evaluate(() => window.__game || null);
async function pollUntil(page, fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const g = await game(page);
    if (g && fn(g)) return g;
    await sleep(1000);
  }
  return await game(page);
}

const server = spawn('node', ['serve.ts'], { cwd: REPO, stdio: 'pipe' });
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
// Lihat shot.mjs: localhost diblokir LNA checks — pakai solarabay.game + route.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const errors = [];
let fail = 0;
const check = (name, ok, extra) => {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
  if (!ok) fail++;
};
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  await page.route('**/solarabay.game/**', async (route) => {
    const u = new URL(route.request().url());
    let p = u.pathname;
    if (p.endsWith('/')) p += 'index.html';
    const r = await fetch('http://localhost:8080' + p + u.search);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = p.slice(p.lastIndexOf('.'));
    await route.fulfill({ status: r.status, contentType: MIME[ext] || 'application/octet-stream', body: buf });
  });
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://solarabay.game/game/?seed=8', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__game, { timeout: 120000 });
  check('game boot', true, JSON.stringify(await game(page)));
  // title → new game
  await page.click('#btnNew');
  await sleep(2000);
  let g = await game(page);
  check('title → play', g && g.phase === 'play', JSON.stringify(g));
  // jalan kaki: W sampai z >= 8 (ke arah Cometa di (-125.4, 12))
  await page.keyboard.down('KeyW');
  g = await pollUntil(page, (s) => s.z >= 8, 90000);
  await page.keyboard.up('KeyW');
  check('jalan kaki selatan', g.z >= 8, '→ (' + g.x + ',' + g.z + ')');
  // strafe barat: A sampai x <= -124
  await page.keyboard.down('KeyA');
  g = await pollUntil(page, (s) => s.x <= -124, 60000);
  await page.keyboard.up('KeyA');
  check('jalan kaki barat', g.x <= -124, '→ (' + g.x + ',' + g.z + ')');
  // curi mobil: E (ulangi + dorong W bila belum dekat)
  for (let i = 0; i < 6 && !g.inCar; i++) {
    await page.keyboard.press('KeyE');
    g = await pollUntil(page, (s) => s.inCar, 8000);
    if (!g.inCar) {
      await page.keyboard.down('KeyW');
      await sleep(3000);
      await page.keyboard.up('KeyW');
      g = await game(page);
    }
  }
  check('curi mobil (inCar)', !!g.inCar, JSON.stringify(g));
  // kendara: W sampai menempuh > 10 m
  const d0 = { x: g.x, z: g.z };
  await page.keyboard.down('KeyW');
  g = await pollUntil(page, (s) => Math.hypot(s.x - d0.x, s.z - d0.z) > 10, 120000);
  await page.keyboard.up('KeyW');
  const drove = Math.hypot(g.x - d0.x, g.z - d0.z);
  check('kendara', g.inCar && drove > 10, 'drove ' + drove.toFixed(1) + 'm, speed ' + g.speed + ' km/h');
  check('0 console/page error', errors.length === 0, errors.slice(0, 5).join(' | '));
  await page.close();
} finally {
  await browser.close();
  server.kill();
}
console.log(fail === 0 ? 'PLAYTEST PASS' : 'PLAYTEST FAIL (' + fail + ')');
process.exit(fail === 0 ? 0 : 1);
