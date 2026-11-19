// Playtest SOLARA BAY (gta6-01, ronde 6g): Playwright headless, game
// diserve dari disk di http://solarabay.game/ (lihat tools/shot.mjs).
// Desktop: boot -> title -> play -> jalan -> curi VELOZ -> drive ->
// keluar mobil, 0 console/page error. Sentuh: konteks hasTouch, joystick
// CDP touch drag gerakkan pemain -> tombol MASUK -> nyetir pakai joystick
// -> keluar mobil. Keluar 1 bila ada langkah FAIL atau error.
//   node tools/playtest.mjs            (desktop 6 langkah)
//   node tools/playtest.mjs --touch    (sentuh 4 langkah)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright');

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const gameDir = join(repo, 'game');
const touchOnly = process.argv.includes('--touch');

const POLICY = '/tmp/webgl-policy.txt';
const policyText = 'hatch-webgl-allowed-domains-v1\nsolarabay.game\n';
writeFileSync(POLICY, policyText);
const policyHash = createHash('sha256').update(policyText).digest('hex');
if (readFileSync(POLICY, 'utf8') !== policyText) throw new Error('webgl policy file mismatch');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const ARGS = ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server',
  '--autoplay-policy=no-user-gesture-required',
  `--hatch-webgl-allowed-domains-file=${POLICY}`, `--hatch-webgl-allowed-domains-sha256=${policyHash}`];
const ENV = { ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '', http_proxy: '', https_proxy: '', NO_PROXY: '*' };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function serveRoute(route) {
  const url = new URL(route.request().url());
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  const file = join(gameDir, rel);
  if (!file.startsWith(gameDir)) return route.abort();
  try {
    await route.fulfill({ status: 200, contentType: MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', body: readFileSync(file) });
  } catch { await route.fulfill({ status: 404, body: 'not found' }); }
}

const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome', args: ARGS, env: ENV });
let failures = 0;
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    hasTouch: touchOnly,
    isMobile: touchOnly,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.route('**/solarabay.game/**', serveRoute);
  const game = () => page.evaluate(() => window.__game || null);
  const pos = async () => { const g = await game(); return g ? [g.px, g.pz] : null; };

  await page.goto('http://solarabay.game/?seed=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__game && window.__game.ready, { timeout: 240000 });
  check('boot', true, 'window.__game ready');

  const titleState = (await game()).state;
  check('title', titleState === 'title', `state=${titleState}`);
  await page.click('#btn-new');
  await page.waitForFunction(() => window.__game.state === 'playing', { timeout: 60000 });
  check('play', true, 'state=playing');

  if (!touchOnly) {
    const p0 = await pos();
    await page.keyboard.down('KeyW');
    await sleep(2500);
    await page.keyboard.up('KeyW');
    const p1 = await pos();
    const moved = p0 && p1 && Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1.5;
    check('jalan kaki (W)', !!moved, `moved ${moved ? Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(1) : 0}m`);

    // Jalan mendekat ke VELOZ sampai < 4 m (diukur live, tahan fps rendah).
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      if ((await game()).distToMissionCar < 4) break;
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyE');
    await sleep(1200);
    const g1 = await game();
    check('curi VELOZ (E)', g1.driving === true, `driving=${g1.driving} car=${g1.car}`);

    const c0 = await pos();
    await page.keyboard.down('KeyW');
    await sleep(3000);
    await page.keyboard.up('KeyW');
    const c1 = await pos();
    const drove = c0 && c1 && Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 5;
    check('drive (W 3s)', !!drove, `drove ${drove ? Math.hypot(c1[0] - c0[0], c1[1] - c0[1]).toFixed(1) : 0}m speed=${(await game()).speed}km/h`);

    await page.keyboard.press('KeyE');
    await sleep(1200);
    const g2 = await game();
    check('keluar mobil (E)', g2.driving === false, `driving=${g2.driving}`);
  } else {
    const touchVisible = await page.evaluate(() => {
      const el = document.querySelector('#touch-ui');
      return !!el && getComputedStyle(el).display !== 'none';
    });
    check('kontrol sentuh tampil', touchVisible, touchVisible ? '' : '#touch-ui hidden');

    // Joystick: drag sentuh ke atas (maju) lewat CDP touch events.
    const joy = await page.evaluate(() => {
      const el = document.querySelector('#joy-base');
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const cdp = await context.newCDPSession(page);
    const p0 = await pos();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joy.x, y: joy.y, id: 1 }] });
    for (let i = 0; i < 40; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: joy.x, y: joy.y - 42, id: 1 }] });
      await sleep(400);
      if ((await game()).distToMissionCar < 4) break;
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const p1 = await pos();
    const moved = p0 && p1 && Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1.5;
    check('joystick gerakkan pemain', !!moved, `moved ${moved ? Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(1) : 0}m`);

    await page.touchscreen.tap(640, 360); // pastikan fokus game
    const enterBtn = await page.evaluate(() => {
      const el = document.querySelector('#btn-enter');
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.touchscreen.tap(enterBtn.x, enterBtn.y);
    await sleep(1500);
    const g1 = await game();
    check('tombol MASUK mobil', g1.driving === true, `driving=${g1.driving} car=${g1.car}`);

    const c0 = await pos();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joy.x, y: joy.y, id: 2 }] });
    let drove = false, droveDist = 0;
    for (let i = 0; i < 40; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: joy.x, y: joy.y - 42, id: 2 }] });
      await sleep(400);
      const cc = await pos();
      if (cc && c0) {
        droveDist = Math.hypot(cc[0] - c0[0], cc[1] - c0[1]);
        if (droveDist > 5) { drove = true; break; }
      }
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const c1 = await pos();
    check('nyetir pakai joystick', drove, `drove ${droveDist.toFixed(1)}m`);

    await page.touchscreen.tap(enterBtn.x, enterBtn.y);
    await sleep(1200);
    const g2 = await game();
    check('tombol KELUAR mobil', g2.driving === false, `driving=${g2.driving}`);
  }

  check('0 console/page error', errors.length === 0, errors.length ? errors.slice(0, 5).join(' | ') : `${results.length} langkah`);
} finally {
  await browser.close();
}
failures = results.filter((r) => !r.ok).length;
console.log(failures === 0 ? 'PLAYTEST ALL PASS' : `PLAYTEST ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
