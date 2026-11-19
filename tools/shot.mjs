// SOLARA BAY — screenshot tool (Playwright + headless Chromium).
// Serves content from localhost:8080 through page.route at the fake host
// http://solarabay.game/ (Chromium in this VM blocks direct localhost
// navigation), waits for window.__shotReady, saves 1280x720 JPEG q85.
// Usage: node tools/shot.mjs [chase|drive|street|night|harbor|all]
// Requires: `node serve.ts` running on :8080, and /tmp/webgl-policy.txt.
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const POLICY = '/tmp/webgl-policy.txt';
const ALL = ['chase', 'drive', 'street', 'night'];
const NAMES = { chase: '1-chase', drive: '2-drive', street: '3-street', night: '4-night', harbor: '5-harbor' };

const wanted = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ALL;

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

let failures = 0;
for (const scene of wanted) {
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
    } catch (err) {
      await route.abort();
    }
  });
  const url = `http://solarabay.game/game/?shot=${scene}&seed=1`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 90000 });
  } catch (err) {
    errors.push('timeout waiting for __shotReady');
  }
  await page.waitForTimeout(400);
  const out = path.join(REPO, 'screenshots', `${NAMES[scene] || scene}.jpg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'jpeg', quality: 85, timeout: 60000 });
  const size = fs.statSync(out).size;
  const state = await page.evaluate(() => (window.__game ? {
    phase: window.__game.phase, wanted: window.__game.wanted,
    mission: window.__game.mission, cash: window.__game.cash,
  } : null));
  console.log(`${scene}: ${out} ${size} bytes ${size <= 256 * 1024 ? 'OK' : 'TOO BIG'} state=${JSON.stringify(state)} errors=${errors.length}`);
  for (const e of errors) console.log('  ERR ' + e);
  if (errors.length || size > 256 * 1024) failures++;
  await page.close();
}
await browser.close();
if (failures) { console.log(`shot.mjs: ${failures} scene(s) failed`); process.exit(1); }
console.log('shot.mjs: all scenes OK');
