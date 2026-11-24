// Screenshot tool for SOLARA BAY (seed 8). Serves game/ from disk through a
// fake host (Chromium blocks localhost navigation here) and captures each
// ?shot= scene at 1280x720 JPEG q85 (phone: 390x844).
// Usage: node tools/shot.mjs [chase drive street night touch road-zoom phone]
// Env: SHOT_ONLY=chase (single scene).
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(join(here, '..'));
const gameRoot = join(repo, 'game');
const policy = readFileSync('/tmp/webgl-policy.txt');
const policyHash = createHash('sha256').update(policy).digest('hex');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };

const SCENES = {
  chase: { file: '1-chase.jpg', dir: 'screenshots', w: 1280, h: 720 },
  drive: { file: '2-drive.jpg', dir: 'screenshots', w: 1280, h: 720 },
  street: { file: '3-street.jpg', dir: 'screenshots', w: 1280, h: 720 },
  night: { file: '4-night.jpg', dir: 'screenshots', w: 1280, h: 720 },
  touch: { file: '5-touch.jpg', dir: 'screenshots-touch', w: 1280, h: 720, touch: true },
  'road-zoom': { file: '6-road-zoom.jpg', dir: 'screenshots-touch', w: 1280, h: 720 },
  phone: { file: '7-phone.jpg', dir: 'screenshots-touch', w: 390, h: 844, touch: true },
};
const wanted = process.argv.slice(2).filter(Boolean);
const only = process.env.SHOT_ONLY;
const list = only ? [only] : (wanted.length ? wanted : Object.keys(SCENES));
const errors = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env: { ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '', http_proxy: '', https_proxy: '', NO_PROXY: '*' },
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    `--hatch-webgl-allowed-domains-sha256=${policyHash}`],
});
let failed = 0;
for (const name of list) {
  const sc = SCENES[name];
  if (!sc) { console.error('unknown scene', name); failed++; continue; }
  const ctx = await browser.newContext({
    viewport: { width: sc.w, height: sc.h },
    hasTouch: !!sc.touch, isMobile: name === 'phone', deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(name + ' console: ' + m.text()); log('CONSOLE-ERROR', name, m.text()); } });
  page.on('pageerror', (e) => { errors.push(name + ' pageerror: ' + e.message); log('PAGEERROR', name, e.message); });
  await page.route('**/solarabay.game/**', async (route) => {
    const u = new URL(route.request().url());
    let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
    const file = resolve(join(gameRoot, normalize(p)));
    if (!file.startsWith(gameRoot + sep) && file !== gameRoot) return route.abort();
    if (!existsSync(file) || !statSync(file).isFile()) return route.abort();
    return route.fulfill({ body: readFileSync(file), contentType: MIME[extname(file)] || 'application/octet-stream' });
  });
  const q = `?shot=${name}&seed=8` + (sc.touch ? '&touch=1' : '');
  log('SHOT', name, '->', sc.dir + '/' + sc.file);
  const t0 = Date.now();
  await page.goto('http://solarabay.game/' + q, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 180000 });
  } catch {
    errors.push(name + ': __shotReady timeout');
    log('TIMEOUT', name);
    failed++;
    await ctx.close();
    continue;
  }
  await page.waitForTimeout(400);
  mkdirSync(join(repo, sc.dir), { recursive: true });
  const outPath = join(repo, sc.dir, sc.file);
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 85 });
  const size = statSync(outPath).size;
  const state = await page.evaluate(() => window.__game || {});
  log('OK', name, size + 'B', ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(state));
  if (size > 262144) { errors.push(name + ': over 256 KiB'); failed++; }
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('ERRORS:', errors.length); for (const e of errors) console.error(' -', e); }
console.log(failed || errors.length ? 'SHOT DONE WITH FAILURES' : 'SHOT ALL OK');
process.exit(failed || errors.length ? 1 : 0);
