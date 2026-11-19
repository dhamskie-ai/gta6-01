// Screenshot tool: renders ?shot= scenes headless, 1280x720 JPEG q92.
// Usage: node tools/shot.mjs [scene] [out-name] — no args = all 4 dossier shots.
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = join(repo, 'game');
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const POLICY_SHA = '7bb678df967ebb65e8b80fd6869d629166db1ea7006957942fadb62a109f109d';

async function take(name, query) {
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    env: { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', all_proxy: '', ALL_PROXY: '', no_proxy: '*', NO_PROXY: '*' },
    args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--no-proxy-server',
      '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
      '--hatch-webgl-allowed-domains-sha256=' + POLICY_SHA],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('page: ' + e.message));
  await page.route('**/solarabay.game/**', async (route) => {
    const url = new URL(route.request().url());
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = join(gameDir, decodeURIComponent(p));
    if (!existsSync(file) || !file.startsWith(gameDir)) return route.abort();
    const ext = p.slice(p.lastIndexOf('.'));
    route.fulfill({ body: readFileSync(file), contentType: MIME[ext] || 'application/octet-stream' });
  });
  await page.goto('http://solarabay.game/' + query, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, undefined, { timeout: 180000 });
  } catch { errors.push('timeout waiting for __shotReady'); }
  await page.waitForTimeout(400);
  const out = join(repo, 'screenshots', name);
  await page.screenshot({ path: out, type: 'jpeg', quality: 92, timeout: 300000 });
  const state = await page.evaluate(() => (window.__game ? window.__game() : null));
  await browser.close();
  console.log(name, JSON.stringify(state), errors.length ? 'ERRORS: ' + errors.join(' | ') : '0 errors');
  return errors;
}

const only = process.argv[2];
let allErr = [];
if (only) {
  const s = shots.find((x) => x.name.startsWith(only) || x.query.includes('shot=' + only));
  const scene = only, name = process.argv[3] || (s ? s.name : only + '.jpg');
  allErr = await take(name, '?shot=' + scene + '&seed=9');
} else {
  for (const s of shots) allErr = allErr.concat(await take(s.name, s.query));
}
if (allErr.length) { console.error('SHOT ERRORS: ' + allErr.length); process.exit(1); }
