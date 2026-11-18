// SOLARA BAY — grab the dossier screenshots with Playwright.
// Headless Chromium on this VM wants the WebGL policy file, and
// localhost is refused by local-network-access checks, so the game files
// are served straight from disk through page.route and the page loads
// under a made-up registrable host instead.
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const GAME_DIR = '/home/hatch/workspace/makefun-all/gta6-01/repo/game';
const SHOT_DIR = '/home/hatch/workspace/makefun-all/gta6-01/repo/screenshots';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
// Pass one scene name to capture just that scene; the dossier itself
// uses four shots (all seed 7, see shots.json) while harbor stays
// manual-only and never lands in the dossier.
const single = process.argv[2] || null;
const SHOT_LIST = [
  ['chase', '1-chase.jpg'],
  ['drive', '2-drive.jpg'],
  ['street', '3-street.jpg'],
  ['night', '4-night.jpg'],
  ['harbor', '5-harbor.jpg'],
].filter(([scene]) => !single || scene === single);

const cleanEnv = {
  ...process.env,
  http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '',
  all_proxy: '', ALL_PROXY: '', no_proxy: '*', NO_PROXY: '*',
};
const chrome = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env: cleanEnv,
  args: [
    '--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    '--hatch-webgl-allowed-domains-sha256=7bb678df967ebb65e8b80fd6869d629166db1ea7006957942fadb62a109f109d',
  ],
});

let failures = 0;
for (const [scene, file] of SHOT_LIST) {
  const page = await chrome.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const fullPath = join(GAME_DIR, requestPath);
    if (existsSync(fullPath)) {
      await route.fulfill({
        status: 200,
        contentType: TYPES[extname(fullPath)] || 'application/octet-stream',
        body: readFileSync(fullPath),
      });
    } else {
      console.log(scene, 'missing', requestPath);
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures += 1;
      console.log(scene, 'console-error:', message.text());
    }
  });
  page.on('pageerror', (err) => {
    failures += 1;
    console.log(scene, 'pageerror:', String(err));
  });
  await page.goto(`http://solarabay.game/?shot=${scene}&seed=7`, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady, null, { timeout: 60000 });
  } catch {
    console.log(scene, 'shotReady timeout');
    failures += 1;
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/${file}`, type: 'jpeg', quality: 85, timeout: 120000 });
  console.log(scene, '->', file);
  await page.close();
}
await chrome.close();
console.log('done, errors:', failures);
process.exit(failures > 0 ? 1 : 0);
