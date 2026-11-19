// SOLARA BAY screenshot tool: Playwright headless Chromium, SwiftShader
// WebGL, game served from disk at http://solarabay.game/.
// Before running, recreate /tmp/webgl-policy.txt with exactly two lines:
//   hatch-webgl-allowed-domains-v1
//   solarabay.game
// (it is wiped on every service restart — check its contents first).
// Usage: node tools/shot.mjs <chase|drive|street|night|roadzoom|touch|phone|all>
// Fixes (6i): MIME lookup keys include the leading dot (without it the
// page is served as octet-stream); waitForFunction takes (fn, arg, opts)
// so the timeout goes in the THIRD argument.
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright');

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const gameDir = join(repo, 'game');
const policyFile = '/tmp/webgl-policy.txt';

// Scenes: dossier shots 1-4 go to screenshots/ (cap 4); the rest are
// verification shots in screenshots-touch/.
const SCENES = {
  chase: { shot: 'chase', out: 'screenshots/1-chase.jpg', w: 1280, h: 720, touch: false },
  drive: { shot: 'drive', out: 'screenshots/2-drive.jpg', w: 1280, h: 720, touch: false },
  street: { shot: 'street', out: 'screenshots/3-street.jpg', w: 1280, h: 720, touch: false },
  night: { shot: 'night', out: 'screenshots/4-night.jpg', w: 1280, h: 720, touch: false },
  roadzoom: { shot: 'roadzoom', out: 'screenshots-touch/6-road-zoom.jpg', w: 1280, h: 720, touch: false },
  touch: { shot: 'touch', out: 'screenshots-touch/5-touch.jpg', w: 1280, h: 720, touch: true },
  phone: { shot: 'phone', out: 'screenshots-touch/7-phone.jpg', w: 390, h: 844, touch: true },
};

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

async function shoot(name) {
  const sc = SCENES[name];
  if (!sc) throw new Error(`unknown scene ${name}`);
  const policy = readFileSync(policyFile, 'utf8');
  const policyHash = createHash('sha256').update(policy).digest('hex');
  const env = { ...process.env };
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome', env,
    args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
      '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
      `--hatch-webgl-allowed-domains-sha256=${policyHash}`],
  });
  const ctx = await browser.newContext({
    viewport: { width: sc.w, height: sc.h },
    hasTouch: sc.touch, isMobile: sc.touch,
    userAgent: sc.touch ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' : undefined,
  });
  const page = await ctx.newPage();
  let errors = 0;
  page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('[console.error]', m.text().slice(0, 200)); } });
  page.on('pageerror', (e) => { errors++; console.log('[pageerror]', String(e).slice(0, 300)); });
  page.on('requestfailed', (r) => console.log('[reqfail]', r.url().slice(0, 120)));
  await page.route('**/solarabay.game/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = join(gameDir, decodeURIComponent(p));
    if (!file.startsWith(gameDir) || !existsSync(file)) return route.abort();
    // MIME keys include the dot — '.html', never 'html'.
    const ext = '.' + file.split('.').pop().toLowerCase();
    return route.fulfill({ body: readFileSync(file), contentType: MIME[ext] ?? 'application/octet-stream' });
  });
  const touchQ = sc.touch ? '&touch=1' : '';
  await page.goto(`http://solarabay.game/?shot=${sc.shot}&seed=8${touchQ}`, { waitUntil: 'load', timeout: 60000 });
  // waitForFunction(fn, arg, options): the timeout belongs in arg 3.
  await page.waitForFunction(() => window.__shotReady === true, undefined, { timeout: 240000 });
  await page.waitForTimeout(400);
  const out = join(repo, sc.out);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
  const size = statSync(out).size;
  console.log(`${name}: ${sc.out} ${sc.w}x${sc.h} ${size} bytes, ${errors} errors${size > 262144 ? ' — OVER 256 KiB!' : ''}`);
  await browser.close();
  if (errors > 0) process.exitCode = 1;
  return size;
}

const want = process.argv[2] || 'all';
const names = want === 'all' ? Object.keys(SCENES) : [want];
for (const n of names) await shoot(n);
console.log('done');
