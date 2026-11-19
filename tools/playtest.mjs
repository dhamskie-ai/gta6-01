// SOLARA BAY — interactive playtest (Playwright + headless Chromium).
// Flow: boot -> title -> New Game -> walk -> steal car -> drive, 0 errors.
// Usage: node tools/playtest.mjs
// Requires: `node serve.ts` running on :8080, and /tmp/webgl-policy.txt.
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright');

const POLICY = '/tmp/webgl-policy.txt';
const policy = fs.readFileSync(POLICY, 'utf8');
const hash = crypto.createHash('sha256').update(policy).digest('hex');

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: [
    '--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server',
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${hash}`,
  ],
  env: {
    ...process.env,
    http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', no_proxy: '*',
  },
});

const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
page.on('pageerror', (err) => errors.push('pageerror: ' + String(err)));
await page.route('**/solarabay.game/**', async (route) => {
  const u = new URL(route.request().url());
  const target = 'http://localhost:8080' + u.pathname + u.search;
  try {
    const res = await fetch(target);
    const body = Buffer.from(await res.arrayBuffer());
    await route.fulfill({
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/octet-stream' },
      body,
    });
  } catch (err) { await route.abort(); }
});

const step = (n, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${detail ? ' — ' + detail : ''}`);
  if (!ok) errors.push('step failed: ' + n);
};

await page.goto('http://solarabay.game/game/?seed=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.__game, { timeout: 60000 });
await page.waitForTimeout(1500);
let g = await page.evaluate(() => ({ phase: window.__game.phase }));
step('boot -> title', g.phase === 'title', `phase=${g.phase}`);

await page.click('#btn-new');
await page.waitForTimeout(1500);
g = await page.evaluate(() => ({ phase: window.__game.phase, mission: window.__game.mission }));
step('new game -> play', g.phase === 'play', `phase=${g.phase} mission=${g.mission}`);

const p0 = await page.evaluate(() => ({ x: window.__game.x, z: window.__game.z }));
await page.keyboard.down('KeyW');
await page.waitForTimeout(25000);
await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => ({ x: window.__game.x, z: window.__game.z }));
const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
step('walk (W 2s)', moved > 3, `moved ${moved.toFixed(1)}m`);

// teleport next to the fixed pink VELOZ COMET RS on the Malecón, then steal it
await page.evaluate(() => window.__game.teleport(-232, 66));
await page.waitForTimeout(300);
const stole = await page.evaluate(() => window.__game.enterNearestCar());
await page.waitForTimeout(500);
g = await page.evaluate(() => ({ inCar: window.__game.inCar }));
step('steal car (E via debug)', stole === true && g.inCar === true, `stole=${stole} inCar=${g.inCar}`);

await page.keyboard.down('KeyW');
await page.waitForTimeout(25000);
await page.keyboard.up('KeyW');
g = await page.evaluate(() => ({ speed: window.__game.speed, x: window.__game.x, z: window.__game.z }));
step('drive (W 3s)', g.speed > 3, `speed=${g.speed.toFixed(1)} m/s at (${g.x.toFixed(0)}, ${g.z.toFixed(0)})`);

// exit the car and confirm we are on foot again
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
g = await page.evaluate(() => ({ inCar: window.__game.inCar }));
step('exit car (E)', g.inCar === false, `inCar=${g.inCar}`);

console.log(`playtest errors: ${errors.length}`);
for (const e of errors) console.log('  ERR ' + e);
await browser.close();
process.exit(errors.length ? 1 : 0);
