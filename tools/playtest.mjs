// SOLARA BAY — interactive playtest via Playwright.
// State-driven (SwiftShader runs ~2 fps, so waits are by game state, not wall
// time): click New Game, walk south to the parked mission car, steal it with
// E, drive, and confirm window.__game shows progress. Fails on any error.
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

const state = () => page.evaluate(() => {
  const g = window.__game;
  if (!g) return null;
  return { phase: g.phase, wanted: g.wanted, cash: g.cash, mission: g.mission, step: g.missionStep, pos: g.position, speed: g.speed, hp: g.health, onFoot: g.onFoot, cars: g.cars };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto('http://solarabay.game/', { waitUntil: 'load', timeout: 60000 });
await sleep(2000);
console.log('title:', JSON.stringify(await state()));
await page.click('#btn-new');
await sleep(1500);
console.log('after new game:', JSON.stringify(await state()));

// Walk to the parked mission car at (2.5, 36) from spawn (2.5, 24).
// Camera yaw is pi, so S walks +z (toward the car).
await page.keyboard.down('KeyS');
let walked = false;
for (let i = 0; i < 120; i++) {
  await sleep(500);
  const s = await state();
  if (s && s.pos[1] >= 33) { walked = true; break; }
}
await page.keyboard.up('KeyS');
console.log('walked:', walked, JSON.stringify(await state()));

// Steal the car with E (mission step 0 -> 1).
await page.keyboard.press('KeyE');
await sleep(1500);
const afterSteal = await state();
console.log('after E:', JSON.stringify(afterSteal));
const stole = afterSteal && !afterSteal.onFoot && afterSteal.step === 1;

// Drive forward (+z) and check speed + position change.
const startPos = afterSteal ? afterSteal.pos : [0, 0];
await page.keyboard.down('KeyW');
let drove = false;
for (let i = 0; i < 120; i++) {
  await sleep(500);
  const s = await state();
  if (s && s.speed > 5 && Math.hypot(s.pos[0] - startPos[0], s.pos[1] - startPos[1]) > 20) { drove = true; break; }
}
await page.keyboard.up('KeyW');
const end = await state();
console.log('after drive:', JSON.stringify(end));
await page.screenshot({ path: '/home/hatch/workspace/makefun-all/gta6-01/repo/screenshots/playtest-end.jpg', type: 'jpeg', quality: 80, timeout: 120000 });

console.log('playtest done, walked:', walked, 'stole:', stole, 'drove:', drove, 'errors:', errors);
await browser.close();
process.exit(walked && stole && drove && errors === 0 ? 0 : 1);
