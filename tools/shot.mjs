// Screenshot runner for SOLARA BAY: Playwright headless, SwiftShader WebGL,
// game served from disk on http://solarabay.game/ via page.route.
// Usage: node tools/shot.mjs all | chase | drive | street | night | touch | roadzoom | phone
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(join(here, '..'));
const gameRoot = join(repo, 'game');
const policyFile = '/tmp/webgl-policy.txt';
const policyHash = createHash('sha256').update(readFileSync(policyFile)).digest('hex');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SCENES = {
  chase: { file: 'screenshots/1-chase.jpg', w: 1280, h: 720, shot: 'chase' },
  drive: { file: 'screenshots/2-drive.jpg', w: 1280, h: 720, shot: 'drive' },
  street: { file: 'screenshots/3-street.jpg', w: 1280, h: 720, shot: 'street' },
  night: { file: 'screenshots/4-night.jpg', w: 1280, h: 720, shot: 'night' },
  touch: { file: 'screenshots-touch/5-touch.jpg', w: 1280, h: 720, shot: 'touch', touch: true },
  roadzoom: { file: 'screenshots-touch/6-road-zoom.jpg', w: 1280, h: 720, shot: 'roadzoom' },
  phone: { file: 'screenshots-touch/7-phone.jpg', w: 390, h: 844, shot: 'phone', touch: true, iphone: true },
};

async function shoot(name) {
  const sc = SCENES[name];
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    env: { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', no_proxy: '*' },
    args: [
      '--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
      '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
      `--hatch-webgl-allowed-domains-sha256=${policyHash}`,
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: sc.w, height: sc.h },
    hasTouch: !!sc.touch,
    isMobile: !!sc.iphone,
    userAgent: sc.iphone ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${name}] pageerror:`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`[${name}] console.error:`, m.text()); });
  await page.route('**/solarabay.game/**', async (route) => {
    const url = new URL(route.request().url());
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = resolve(join(gameRoot, normalize(p)));
    if (file !== gameRoot && !file.startsWith(gameRoot + sep)) return route.abort();
    if (!existsSync(file)) return route.abort();
    await route.fulfill({ status: 200, contentType: MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', body: readFileSync(file) });
  });
  await page.goto(`http://solarabay.game/?shot=${sc.shot}&seed=8`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady, undefined, { timeout: 240000 });
  await page.waitForTimeout(400);
  const out = join(repo, sc.file);
  mkdirSync(join(out, '..'), { recursive: true });
  await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
  console.log(`[${name}] wrote ${sc.file}`);
  await browser.close();
}

const arg = process.argv[2] || 'all';
const names = arg === 'all' ? Object.keys(SCENES) : [arg];
for (const n of names) {
  if (!SCENES[n]) { console.error('unknown scene:', n); process.exit(1); }
  await shoot(n);
}
console.log('done');
