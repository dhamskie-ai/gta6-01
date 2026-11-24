// Desktop (+touch) playtest for SOLARA BAY. Route-served like shot.mjs.
// Flow: boot -> NEW GAME -> walk -> steal the VELOZ -> drive waypoints with
// lane-offset stuck recovery -> exit car -> mission state. 0 console/page
// errors required. Timeout 600 s (SwiftShader is ~1 fps here).
// Usage: node tools/playtest.mjs [--touch]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(join(here, '..'));
const gameRoot = join(repo, 'game');
const touchMode = process.argv.includes('--touch');
const policyHash = createHash('sha256').update(readFileSync('/tmp/webgl-policy.txt')).digest('hex');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const errors = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROADS = [-240, -120, 0, 120, 240];
const nearRoad = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), ROADS[0]);
let page;
let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; log('PASS', name, extra); }
  else { fail++; log('FAIL', name, extra); }
}
async function state() { return page.evaluate(() => window.__game || {}); }
async function key(code, ms) { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); }
// Enter/exit via the on-screen MASUK/KELUAR button in touch mode (exercises
// the touch wiring, not just the keyboard path).
async function pressAct() {
  if (touchMode) await page.tap('#btnAct');
  else await page.keyboard.press('KeyE');
}

async function driveTo(tx, tz, label, timeoutMs = 300000) {
  const s0 = await state();
  const rx1 = nearRoad(tx), rz1 = nearRoad(tz);
  const rx0 = nearRoad(s0.x), rz0 = nearRoad(s0.z);
  const wps = Math.hypot(tx - s0.x, tz - s0.z) < 30 ? [[tx, tz]]
    : [[rx0, s0.z], [rx0, rz1], [rx1, rz1], [tx, tz]];
  log('DRIVE', label, 'route', JSON.stringify(wps));
  const t0 = Date.now();
  let wi = 0, lastMove = Date.now(), lx = s0.x, lz = s0.z, stuckN = 0, latOff = 0;
  const held = new Set();
  const hold = async (code, on) => {
    if (on && !held.has(code)) { await page.keyboard.down(code); held.add(code); }
    if (!on && held.has(code)) { await page.keyboard.up(code); held.delete(code); }
  };
  const releaseAll = async () => { for (const c of [...held]) await hold(c, false); };
  try {
    while (Date.now() - t0 < timeoutMs) {
      const s = await state();
      if (s.phase !== 'play') { log('DRIVE', label, 'phase=', s.phase); await releaseAll(); return false; }
      if (!s.inCar) { log('DRIVE', label, 'NOT IN CAR'); await releaseAll(); return false; }
      const [wx, wz] = wps[wi];
      const dx = wx - s.x, dz = wz - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 8) {
        wi++;
        if (wi >= wps.length) { await releaseAll(); log('DRIVE', label, 'ARRIVED'); return true; }
        continue;
      }
      // Steer toward the waypoint, with a lateral lane offset after a stuck.
      const moved = Math.hypot(s.x - lx, s.z - lz);
      if (moved > 0.5) { lastMove = Date.now(); lx = s.x; lz = s.z; }
      if (Date.now() - lastMove > 20000) {
        stuckN++;
        latOff = stuckN % 2 === 1 ? 6 : -6;
        log('DRIVE', label, 'STUCK #' + stuckN, 'lane offset', latOff);
        await hold('KeyW', false); await hold('KeyA', false); await hold('KeyD', false);
        await key('KeyS', 1200);
        await key(stuckN % 2 ? 'KeyA' : 'KeyD', 700);
        lastMove = Date.now();
      }
      // Aim at the waypoint shifted laterally by latOff (other lane).
      const px = -dz, pz = dx, pl = Math.hypot(px, pz) || 1;
      const ax = wx + (px / pl) * latOff, az = wz + (pz / pl) * latOff;
      const bearing = Math.atan2(ax - s.x, az - s.z);
      const cur = s.heading || 0;
      let dh = bearing - cur;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      await hold('KeyW', true);
      // dh<0 (target right of nose) -> D decreases heading toward the target.
      await hold('KeyD', dh < -0.05);
      await hold('KeyA', dh > 0.05);
      if (dist < 25) { await hold('KeyW', true); }
      await sleep(400);
    }
  } finally { await releaseAll(); }
  log('DRIVE', label, 'TIMEOUT');
  return false;
}

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env: { ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '', http_proxy: '', https_proxy: '', NO_PROXY: '*' },
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    `--hatch-webgl-allowed-domains-sha256=${policyHash}`],
});
const ctx = await browser.newContext({
  viewport: { width: 640, height: 360 }, hasTouch: touchMode, isMobile: touchMode,
});
page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') { errors.push('console: ' + m.text()); log('CONSOLE-ERROR', m.text()); } });
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); log('PAGEERROR', e.message); });
await page.route('**/solarabay.game/**', async (route) => {
  const u = new URL(route.request().url());
  let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
  const file = resolve(join(gameRoot, normalize(p)));
  if (!file.startsWith(gameRoot + sep) && file !== gameRoot) return route.abort();
  if (!existsSync(file) || !statSync(file).isFile()) return route.abort();
  return route.fulfill({ body: readFileSync(file), contentType: MIME[extname(file)] || 'application/octet-stream' });
});
await page.goto('http://solarabay.game/?seed=8' + (touchMode ? '&touch=1' : ''), { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__game !== undefined, { timeout: 120000 });
let s = await state();
check('boot (title phase)', s.phase === 'title', JSON.stringify(s));
if (touchMode) {
  const vis = await page.evaluate(() => {
    const el = document.getElementById('touchUI');
    return el && !el.classList.contains('hidden');
  });
  check('touch UI visible', !!vis);
  await page.tap('#btnNew');
} else {
  await page.click('#btnNew');
}
await sleep(2000);
s = await state();
check('new game -> play', s.phase === 'play', JSON.stringify(s));
// Walk north toward the VELOZ (spawn -240,80 -> veloz -240,66).
const sWalk0 = await state();
await key('KeyW', 9000);
s = await state();
check('walked forward', Math.hypot(s.x - sWalk0.x, s.z - sWalk0.z) > 2, JSON.stringify(s));
// Walk to the Veloz in short bursts; correct an overshoot (SwiftShader
// frames are coarse, so a long hold can walk straight past the car).
for (let i = 0; i < 40; i++) {
  s = await state();
  const d = Math.hypot(s.x + 240, s.z - 66);
  if (d < 3.5) break;
  if (s.z < 62) await key('KeyS', 800); // walked past it (north), step back south
  else await key('KeyW', 1200);
}
// Press E until the VELOZ itself is entered (a passing traffic car can be
// nearer than the parked Veloz — stealing it is legal in-game, just not
// what this leg tests). Retry a few times; traffic moves on.
let stoleVeloz = false;
for (let i = 0; i < 6 && !stoleVeloz; i++) {
  await pressAct();
  await sleep(1500);
  s = await state();
  if (s.inCar && s.car === 'Veloz Comet RS') { stoleVeloz = true; break; }
  if (s.inCar) { await pressAct(); await sleep(1200); } // exit wrong car
  // Step back toward the Veloz and try again.
  await key('KeyS', 600);
}
s = await state();
check('stole VELOZ (inCar)', stoleVeloz, JSON.stringify(s));
if (s.inCar) {
  await sleep(2000); // let heading settle to the car's heading before steering
  const ok = await driveTo(0, -180, 'to Courier checkpoint', 300000);
  check('drove to (0,-180)', ok);
  s = await state();
  log('after drive', JSON.stringify(s));
  await pressAct();
  await sleep(1200);
  s = await state();
  check('exited car', !s.inCar, JSON.stringify(s));
}
s = await state();
check('mission active', s.mission >= 1, JSON.stringify(s));
check('health > 0', s.health > 0, JSON.stringify(s));
await browser.close();
log('PLAYTEST', touchMode ? 'touch' : 'desktop', 'PASS', pass, 'FAIL', fail, 'ERRORS', errors.length);
if (errors.length) for (const e of errors) console.error(' -', e);
process.exit(fail || errors.length ? 1 : 0);
