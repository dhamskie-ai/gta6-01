// Dossier builder SOLARA BAY: salin game/ + screenshots/ ke output lalu tulis dossier.json.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || 'out');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync('game', join(outDir, 'game'), { recursive: true });
if (existsSync('screenshots')) cpSync('screenshots', join(outDir, 'screenshots'), { recursive: true });
const bytes = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), bytes);
console.log(`dossier ditulis: ${join(outDir, 'dossier.json')} (${bytes.length} byte)`);
