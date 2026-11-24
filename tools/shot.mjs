// SOLARA BAY — screenshot capture via Playwright.
// Chromium on this VM needs the WebGL policy file; localhost is blocked by
// local-network-access checks, so files are served from disk through
// page.route and the page is opened at a fake registrable host.
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = '/home/hatch/workspace/makefun-all/gta6-01/repo/game';
const OUT = '/home/hatch/workspace/makefun-all/gta6-01/repo/screenshots';
const OUT_TOUCH = '/home/hatch/workspace/makefun-all/gta6-01/repo/screenshots-touch';
mkdirSync(OUT, { recursive: true });
mkdirSync(OUT_TOUCH, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
// [scene, file, outDir, extra query]
const scenes = [
  ['chase', '1-chase.jpg', OUT, ''],
  ['drive', '2-drive.jpg', OUT, ''],
  ['street', '3-street.jpg', OUT, ''],
  ['night', '4-night.jpg', OUT, ''],
  ['touch', '5-touch.jpg', OUT_TOUCH, '&touch=1'],
  ['road-zoom', '6-road-zoom.jpg', OUT_TOUCH, ''],
  ['phone', '7-phone.jpg', OUT_TOUCH, ''],
];

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

let errors = 0;
for (const [scene, file, outDir, extra] of scenes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = join(ROOT, p);
    if (existsSync(full)) {
      await route.fulfill({ status: 200, contentType: MIME[extname(full)] || 'application/octet-stream', body: readFileSync(full) });
    } else {
      console.log(scene, 'missing', p);
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  page.on('console', (m) => { if (m.type() === 'error') { errors += 1; console.log(scene, 'console-error:', m.text()); } });
  page.on('pageerror', (e) => { errors += 1; console.log(scene, 'pageerror:', String(e)); });
  await page.goto(`http://solarabay.game/?shot=${scene}&seed=8${extra}`, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady, null, { timeout: 60000 });
  } catch {
    console.log(scene, 'shotReady timeout');
    errors += 1;
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${file}`, type: 'jpeg', quality: 85 });
  console.log(scene, '->', file);
  await page.close();
}
await browser.close();
console.log('done, errors:', errors);
process.exit(errors > 0 ? 1 : 0);
