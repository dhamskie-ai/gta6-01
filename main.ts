// SOLARA BAY — entrypoint dossier (gta6-01, ronde 6g).
// Menyalin game/ + screenshots/ dari sebelah file ini ke direktori output
// lalu menulis dossier.json di sana. Jalankan lokal dengan:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Di dalam container grader, MAKEFUN_OUTPUT_DIR diganti /output.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Cap scorer (reference/gate.json): text_max_bytes yang membentuk byte
// dossier; sisanya menolak entry yang scorer akan tolak (lebih dari 4
// screenshot atau satu di atas 256 KiB; game/ lebih dari 993 file atau
// 48 MiB, atau satu path di bawah game/ di atas 1000 byte).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`dossier written to ${join(outDir, 'dossier.json')}`);
