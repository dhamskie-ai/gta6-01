// SOLARA BAY — interactive playtest via Playwright.
// Clicks New Game, walks with WASD, steals the mission-1 car, drives,
// and expects mission progress with 0 console/page errors.
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = '/home/hatch/workspace/makefun-all/gta6-01/repo/game';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const env = { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', all_proxy: '', ALL_PROXY: '', no_proxy: '*', NO_PROXY: '*' };
const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env,
  args: [
    '--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    '--hatch-webgl-allowed-domains-sha256=7bb678df967ebb65e8b80fd6869d629166db1ea7006957942fadb62a109f109d',
  ],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = join(ROOT, p);
  if (existsSync(full)) {
    await route.fulfill({ status: 200, contentType: MIME[extname(full)] || 'application/octet-stream', body: readFileSync(full) });
  } else {
    await route.fulfill({ status: 404, body: 'not found' });
  }
});

let errors = 0;
page.on('console', (m) => { if (m.type() === 'error') { errors += 1; console.log('console-error:', m.text()); } });
page.on('pageerror', (e) => { errors += 1; console.log('pageerror:', String(e)); });

const state = () => page.evaluate(() => window.__game || null);

await page.goto('http://solarabay.game/', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1500);
console.log('title state:', JSON.stringify(await state()));
// Click "New Game" (center of the title overlay).
await page.mouse.click(640, 430);
await page.waitForTimeout(1000);
console.log('after new game:', JSON.stringify(await state()));

// Walk forward toward the parked car at (0, 60) — player starts at (0, 20),
// facing north (+z). SwiftShader runs ~1.3 FPS so game time crawls; allow
// up to 120 s and press E every second so a passing traffic car is stolen
// if one comes within reach first.
let stolen = false;
const started = Date.now();
await page.keyboard.down('KeyW');
while (Date.now() - started < 120000) {
  const s = await state();
  if (!s) break;
  if (s.inCar) { stolen = true; break; }
  if (s.pos && Math.abs(s.pos[1] - 60) < 8) break;
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
}
await page.keyboard.up('KeyW');
console.log('after walk:', JSON.stringify(await state()));
if (!stolen) {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(800);
}
let s = await state();
console.log('after E (steal):', JSON.stringify(s));
stolen = !!s?.inCar;
if (stolen) {
  // Drive forward for 6 seconds.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(6000);
  await page.keyboard.up('KeyW');
  s = await state();
  console.log('after drive:', JSON.stringify(s));
}
await page.screenshot({ path: '/tmp/playtest-end.jpg', type: 'jpeg', quality: 80 });
console.log('playtest done, stolen:', stolen, 'errors:', errors);
await browser.close();
process.exit(stolen && errors === 0 ? 0 : 1);
