// SOLARA BAY playtest: desktop (title -> walk -> steal VELOZ -> drive ->
// exit) plus a touch-mode check (joystick moves the player). Same Chromium
// + solarabay.game route method as tools/shot.mjs. Exits non-zero on any
// console/page error or failed step.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';

const NODE = '/home/hatch/node22/node-v22.21.1-linux-x64/bin/node';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const policyHash = createHash('sha256').update(readFileSync('/tmp/webgl-policy.txt')).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
function norm(a) { let d = a % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

const server = spawn(NODE, ['serve.ts'], { cwd: ROOT, stdio: 'ignore' });
await sleep(1500);
const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env: { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', all_proxy: '', ALL_PROXY: '', no_proxy: '*', NO_PROXY: '*' },
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    `--hatch-webgl-allowed-domains-sha256=${policyHash}`],
});
let failed = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed++;
}
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route('**/solarabay.game/**', async (route) => {
    const url = new URL(route.request().url());
    const res = await fetch('http://127.0.0.1:8080' + url.pathname + url.search);
    const body = Buffer.from(await res.arrayBuffer());
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') || undefined, body });
  });
  await page.goto('http://solarabay.game/?seed=8', { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  let g = await page.evaluate(() => window.__game);
  check('boot', !!g && g.phase === 'title', `phase=${g?.phase}`);
  await page.evaluate(() => document.getElementById('btn-new').click());
  await sleep(2000);
  g = await page.evaluate(() => window.__game);
  check('new game starts', g.phase === 'play', `phase=${g.phase}`);
  const start = { x: g.x, z: g.z };
  // --- autopilot: steer toward a target with W + A/D ---
  const held = new Set();
  async function setKeys(want) {
    for (const k of ['w', 'a', 's', 'd']) {
      if (want.includes(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
      if (!want.includes(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    }
  }
  async function driveTo(tx, tz, timeoutMs, arriveD) {
    const t0 = Date.now();
    let lastPos = null, lastMove = Date.now(), reversing = 0;
    while (Date.now() - t0 < timeoutMs) {
      g = await page.evaluate(() => window.__game);
      const dx = tx - g.x, dz = tz - g.z;
      const d = Math.hypot(dx, dz);
      if (d < arriveD) return { ok: true, d };
      if (lastPos && Math.hypot(g.x - lastPos.x, g.z - lastPos.z) > 0.1) lastMove = Date.now();
      lastPos = { x: g.x, z: g.z };
      if (Date.now() - lastMove > 30000 && reversing <= 0) {
        reversing = 3000;
        console.log('  stuck — reversing');
      }
      const desired = Math.atan2(dx, dz);
      const diff = norm(desired - g.heading);
      let keys = ['w'];
      if (reversing > 0) { keys = ['s']; if (diff > 0) keys.push('d'); else keys.push('a'); reversing -= 800; }
      else if (diff > 0.18) keys.push('d');
      else if (diff < -0.18) keys.push('a');
      await setKeys(keys);
      await sleep(800);
    }
    await setKeys([]);
    return { ok: false, d: Math.hypot(tx - g.x, tz - g.z) };
  }
  // walk to the VELOZ (-240, 66)
  const walk = await driveTo(-240, 66, 180000, 3.2);
  await setKeys([]);
  g = await page.evaluate(() => window.__game);
  const walked = Math.hypot(g.x - start.x, g.z - start.z);
  check('walk to VELOZ', walk.ok, `walked ${walked.toFixed(1)} m, dist ${walk.d?.toFixed(1)}`);
  // steal it
  await page.keyboard.press('e');
  await sleep(2500);
  g = await page.evaluate(() => window.__game);
  check('steal VELOZ (inCar)', g.inCar === true, `inCar=${g.inCar} msn=${g.msn} step=${g.step}`);
  // drive south down the Malecón to (-240, -60)
  const d1 = await driveTo(-240, -60, 240000, 8);
  await setKeys([]);
  g = await page.evaluate(() => window.__game);
  const driven = Math.hypot(g.x - start.x, g.z - start.z);
  check('drive leg 1', d1.ok, `dist ${d1.d.toFixed(1)} speed ${g.speed} km/h`);
  check('drove far', driven > 100, `displacement ${driven.toFixed(1)} m`);
  // exit the car
  await page.keyboard.press('e');
  await sleep(2000);
  g = await page.evaluate(() => window.__game);
  check('exit car', g.onFoot === true && g.inCar === false, `onFoot=${g.onFoot}`);
  check('mission advanced', g.msn === 0 && g.step >= 2, `msn=${g.msn} step=${g.step}`);
  await page.close();

  // --- touch mode ---
  const tp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  tp.on('console', (m) => { if (m.type() === 'error') errors.push('touch console: ' + m.text()); });
  tp.on('pageerror', (e) => errors.push('touch pageerror: ' + e.message));
  await tp.route('**/solarabay.game/**', async (route) => {
    const url = new URL(route.request().url());
    const res = await fetch('http://127.0.0.1:8080' + url.pathname + url.search);
    const body = Buffer.from(await res.arrayBuffer());
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') || undefined, body });
  });
  await tp.goto('http://solarabay.game/?seed=8&touch=1', { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  const touchVisible = await tp.evaluate(() => {
    const el = document.getElementById('touch-controls');
    return el && !el.classList.contains('hidden');
  });
  check('touch controls visible', touchVisible);
  await tp.evaluate(() => document.getElementById('btn-new').click());
  await sleep(2000);
  const t0 = await tp.evaluate(() => window.__game);
  // drag the joystick upward (pointer events drive it)
  const joy = await tp.evaluate(() => {
    const r = document.getElementById('joy-base').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await tp.mouse.move(joy.x, joy.y);
  await tp.mouse.down();
  await tp.mouse.move(joy.x, joy.y - 40, { steps: 5 });
  await sleep(6000);
  await tp.mouse.up();
  const t1 = await tp.evaluate(() => window.__game);
  const moved = Math.hypot(t1.x - t0.x, t1.z - t0.z);
  check('touch joystick moves player', moved > 1, `moved ${moved.toFixed(1)} m`);
  await tp.close();
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log('ERRORS:'); for (const e of errors) console.log('  ' + e); }
check('0 console/page errors', errors.length === 0, `${errors.length} errors`);
console.log(failed ? `PLAYTEST FAILED (${failed})` : 'PLAYTEST PASSED');
process.exit(failed || errors.length ? 1 : 0);
