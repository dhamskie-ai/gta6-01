// SOLARA BAY — interactive playtest via Playwright.
// Clicks NEW GAME, drives with WASD, steals a car with E, checks mission 1
// advances, and expects 0 console/page errors. Also runs a touch-mode load.
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

async function newPageWithRoute() {
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
  return page;
}

let errors = 0;
const state = (page) => page.evaluate(() => {
  const g = window.__game;
  if (!g) return null;
  return { phase: g.phase, wanted: g.wanted, cash: g.cash, mission: g.mission, stage: g.missionStage, hp: g.hp, inCar: g.inCar, speed: Math.round(g.speed), traffic: g.traffic, peds: g.peds };
});

// --- Desktop playtest ---
const page = await newPageWithRoute();
page.on('console', (m) => { if (m.type() === 'error') { errors += 1; console.log('desktop console-error:', m.text()); } });
page.on('pageerror', (e) => { errors += 1; console.log('desktop pageerror:', String(e)); });
await page.goto('http://solarabay.game/?seed=8', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1200);
console.log('title:', JSON.stringify(await state(page)));
await page.click('#btnNew');
await page.waitForTimeout(800);
console.log('after new game:', JSON.stringify(await state(page)));
// Walk toward the mission-1 car (-104,-104) from (-96,-96): W+D moves
// diagonally (-x,-z) with the default camera yaw. Then E to steal it.
await page.keyboard.down('KeyW');
await page.keyboard.down('KeyD');
await page.waitForTimeout(30000); // headless SwiftShader runs ~1-2 fps; wall time, not frames
await page.keyboard.up('KeyW');
await page.keyboard.up('KeyD');
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
console.log('after E (steal attempt):', JSON.stringify(await state(page)));
// Drive forward for a while (headless SwiftShader is slow; use wall time).
await page.keyboard.down('KeyW');
await page.waitForTimeout(20000);
await page.keyboard.up('KeyW');
console.log('after driving:', JSON.stringify(await state(page)));
// Pause / resume.
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('paused:', JSON.stringify(await state(page)));
await page.click('#btnResume');
await page.waitForTimeout(400);
console.log('resumed:', JSON.stringify(await state(page)));
const desktop = await state(page);
await page.close();

// --- Touch-mode load check ---
const tp = await newPageWithRoute();
tp.on('console', (m) => { if (m.type() === 'error') { errors += 1; console.log('touch console-error:', m.text()); } });
tp.on('pageerror', (e) => { errors += 1; console.log('touch pageerror:', String(e)); });
await tp.goto('http://solarabay.game/?seed=8&touch=1', { waitUntil: 'load', timeout: 60000 });
await tp.waitForTimeout(1200);
console.log('touch load:', JSON.stringify(await state(tp)));
await tp.click('#btnNew');
await tp.waitForTimeout(800);
console.log('touch after new game:', JSON.stringify(await state(tp)));
await tp.close();

await browser.close();
const ok = desktop && desktop.phase === 'playing' && desktop.traffic === 36 && desktop.peds >= 150 && errors === 0;
console.log('playtest done, desktop:', JSON.stringify(desktop), 'errors:', errors);
process.exit(ok ? 0 : 1);
