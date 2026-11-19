// Playtest: title -> new game -> walk -> steal -> drive, 0 console errors.
// Usage: node tools/playtest.mjs
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = join(repo, 'game');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const POLICY_SHA = '7bb678df967ebb65e8b80fd6869d629166db1ea7006957942fadb62a109f109d';

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env: { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', all_proxy: '', ALL_PROXY: '', no_proxy: '*', NO_PROXY: '*' },
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    '--hatch-webgl-allowed-domains-sha256=' + POLICY_SHA],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('page: ' + e.message));
await page.route('**/solarabay.game/**', async (route) => {
  const url = new URL(route.request().url());
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(gameDir, decodeURIComponent(p));
  if (!existsSync(file) || !file.startsWith(gameDir)) return route.abort();
  const ext = p.slice(p.lastIndexOf('.'));
  route.fulfill({ body: readFileSync(file), contentType: MIME[ext] || 'application/octet-stream' });
});
await page.goto('http://solarabay.game/', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2500);
console.log('title state:', JSON.stringify(await page.evaluate(() => window.__game())));
await page.click('#btnnew');
await page.waitForTimeout(1500);
await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');
const walked = await page.evaluate(() => window.__game());
console.log('walked:', JSON.stringify(walked));
// teleport next to a parked car and steal it, then drive
await page.evaluate(() => {
  const G = window.__G;
  const car = G.vehicles.cars[0];
  G.player.reset(car.x + 3, car.z + 2, 0);
});
await page.keyboard.press('KeyE');
await page.waitForTimeout(800);
const stole = await page.evaluate(() => window.__game());
console.log('stole (inCar should be true):', JSON.stringify(stole));
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW');
const drove = await page.evaluate(() => window.__game());
console.log('drove:', JSON.stringify(drove));
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'PLAYTEST 0 errors');
if (errors.length) process.exit(1);
if (!stole.inCar) { console.error('PLAYTEST FAIL: steal did not put player in car'); process.exit(1); }
if (drove.speed < 5) { console.error('PLAYTEST FAIL: car did not move, speed=' + drove.speed); process.exit(1); }
console.log('PLAYTEST PASS');
