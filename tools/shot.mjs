// Screenshot SOLARA BAY (gta6-01, ronde 6g): Playwright headless dengan
// Chromium VM, WebGL SwiftShader, game diserve dari disk lewat page.route
// di host palsu http://solarabay.game/ (host itu yang diizinkan WebGL).
//   node tools/shot.mjs            -> 4 shot dari shots.json ke screenshots/
//   node tools/shot.mjs --touch    -> 1 shot mode sentuh ke screenshots-touch/
// Tiap shot menunggu window.__shotReady lalu menyimpan JPEG 1280x720 q85.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
const policyCheck = readFileSync(POLICY, 'utf8');
if (policyCheck !== policyText) throw new Error('webgl policy file mismatch');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-gpu',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--no-proxy-server',
  '--autoplay-policy=no-user-gesture-required',
  `--hatch-webgl-allowed-domains-file=${POLICY}`,
  `--hatch-webgl-allowed-domains-sha256=${policyHash}`,
];
const ENV = { ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '', http_proxy: '', https_proxy: '', NO_PROXY: '*' };

async function serveRoute(route) {
  const url = new URL(route.request().url());
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  const file = join(gameDir, rel);
  if (!file.startsWith(gameDir)) return route.abort();
  try {
    const body = readFileSync(file);
    await route.fulfill({ status: 200, contentType: MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', body });
  } catch {
    await route.fulfill({ status: 404, body: 'not found' });
  }
}

const shots = touchOnly
  ? [{ name: '5-touch', query: '?shot=drive&seed=1' }]
  : JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8')).shots;

const outDir = join(repo, touchOnly ? 'screenshots-touch' : 'screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: CHROME_ARGS,
  env: ENV,
});
let failed = 0;
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    hasTouch: touchOnly,
    isMobile: touchOnly,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.route('**/solarabay.game/**', serveRoute);

  for (const shot of shots) {
    const t0 = Date.now();
    await page.goto(`http://solarabay.game/${shot.query}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 240000 });
    if (touchOnly) {
      await page.waitForFunction(() => {
        const el = document.querySelector('#touch-ui');
        return el && getComputedStyle(el).display !== 'none';
      }, { timeout: 30000 });
    }
    await page.waitForTimeout(800);
    const dest = join(outDir, `${shot.name}.jpg`);
    await page.screenshot({ path: dest, type: 'jpeg', quality: 85 });
    const size = (await import('node:fs')).statSync(dest).size;
    console.log(`${shot.name}.jpg  ${size} bytes  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${size <= 262144 ? 'OK' : 'OVER 256KiB'}`);
    if (size > 262144) failed++;
  }
  if (errors.length) { console.log('ERRORS during capture:'); errors.forEach((e) => console.log('  ' + e)); failed++; }
  else console.log('0 console/page errors');
} finally {
  await browser.close();
}
if (failed) process.exit(1);
console.log('done');
