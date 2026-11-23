// SOLARA BAY screenshot tool. Serves game/ from disk on :8080, opens it
// in headless Chromium through the fake host http://solarabay.game/ (this
// Chromium build blocks navigation to localhost), waits for
// window.__shotReady, and saves a JPEG per scene. Seed 8, 1280x720.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';

const NODE = '/home/hatch/node22/node-v22.21.1-linux-x64/bin/node';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POLICY = '/tmp/webgl-policy.txt';
const policyHash = createHash('sha256').update(readFileSync(POLICY)).digest('hex');

const SCENES = [
  { name: 'chase', file: 'screenshots/1-chase.jpg', w: 1280, h: 720 },
  { name: 'drive', file: 'screenshots/2-drive.jpg', w: 1280, h: 720 },
  { name: 'street', file: 'screenshots/3-street.jpg', w: 1280, h: 720 },
  { name: 'night', file: 'screenshots/4-night.jpg', w: 1280, h: 720 },
  { name: 'touch', file: 'screenshots-touch/5-touch.jpg', w: 1280, h: 720, touch: true },
  { name: 'road-zoom', file: 'screenshots-touch/6-road-zoom.jpg', w: 1280, h: 720 },
  { name: 'phone', file: 'screenshots-touch/7-phone.jpg', w: 390, h: 844, touch: true },
];
const only = process.argv[2]; // optional single scene name
const list = only ? SCENES.filter((s) => s.name === only) : SCENES;
if (!list.length) { console.error('unknown scene', only); process.exit(2); }

const server = spawn(NODE, ['serve.ts'], { cwd: ROOT, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);

let failed = 0;
const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env: { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', all_proxy: '', ALL_PROXY: '', no_proxy: '*', NO_PROXY: '*' },
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    `--hatch-webgl-allowed-domains-sha256=${policyHash}`],
});
try {
  for (const scene of list) {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: scene.w, height: scene.h },
      hasTouch: !!scene.touch, isMobile: !!scene.touch });
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.route('**/solarabay.game/**', async (route) => {
      const url = new URL(route.request().url());
      const target = 'http://127.0.0.1:8080' + url.pathname + url.search;
      const res = await fetch(target);
      const body = Buffer.from(await res.arrayBuffer());
      await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') || undefined, body });
    });
    const q = `?shot=${scene.name}&seed=8` + (scene.touch ? '&touch=1' : '');
    await page.goto('http://solarabay.game/' + q, { waitUntil: 'load', timeout: 60000 });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
    } catch {
      errors.push('timeout waiting for __shotReady');
    }
    await sleep(1500);
    const outPath = join(ROOT, scene.file);
    mkdirSync(dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 92, timeout: 180000 });
    const size = readFileSync(outPath).length;
    console.log(`${scene.name}: ${scene.file} ${size} bytes, errors=${errors.length}`);
    for (const e of errors) console.log('  ' + e);
    if (errors.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? `FAILED: ${failed} scene(s) with errors` : 'all scenes clean');
process.exit(failed ? 1 : 0);
