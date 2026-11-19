// SOLARA BAY — dossier bundle entrypoint.
// Copies game/ + screenshots/ into the output dir and writes dossier.json
// (file list + source outline + screenshot inventory) for `makefun check`.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || path.join(ROOT, 'out');
const TITLE = 'SOLARA BAY';
const COMPETITION = 'gta6-01';
const OWNER_WALLET = '6aQ6tuKUAvjyfaya7AGvf8juTQ5TDTfVAvVmoKiaDjPK';

function walk(dir: string, base: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) walk(full, rel, out);
    else if (entry.isFile()) out.push(rel);
  }
}

function copyTree(srcDir: string, dstDir: string): void {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function firstDeclarations(text: string): string[] {
  const found: string[] = [];
  const re = /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && found.length < 24) found.push(m[1]);
  const re2 = /^\s*export\s*\{\s*([^}]+)\}/gm;
  while ((m = re2.exec(text)) !== null && found.length < 24) {
    for (const name of m[1].split(',')) {
      const n = name.trim().split(/\s+as\s+/).pop() as string;
      if (n) found.push(n);
    }
  }
  return [...new Set(found)];
}

function buildDossier(): Record<string, unknown> {
  const gameDir = path.join(ROOT, 'game');
  const shotDir = path.join(ROOT, 'screenshots');
  const files: { path: string; bytes: number; declarations: string[] }[] = [];
  const rels: string[] = [];
  walk(gameDir, 'game', rels);
  let textBytes = 0;
  for (const rel of rels.sort()) {
    const full = path.join(ROOT, rel);
    const buf = fs.readFileSync(full);
    // Vendored bundles (*.min.js under game/vendor/) are not agent source:
    // they are excluded from the dossier text-byte budget (see DESIGN §4.1).
    const isVendor = rel.includes('/vendor/') || rel.includes('\\vendor\\');
    const isText = !isVendor && /\.(js|html|json|css|md)$/.test(rel);
    if (isText) textBytes += buf.length;
    files.push({
      path: rel,
      bytes: buf.length,
      declarations: isText ? firstDeclarations(buf.toString('utf8')) : [],
    });
  }
  const shots: { name: string; bytes: number }[] = [];
  if (fs.existsSync(shotDir)) {
    for (const name of fs.readdirSync(shotDir).sort()) {
      const full = path.join(shotDir, name);
      if (fs.statSync(full).isFile()) shots.push({ name, bytes: fs.statSync(full).size });
    }
  }
  return {
    title: TITLE,
    competition: COMPETITION,
    ownerWallet: OWNER_WALLET,
    textBytes,
    files,
    screenshots: shots,
    builtAt: new Date().toISOString(),
  };
}

function main(): void {
  fs.mkdirSync(OUT, { recursive: true });
  copyTree(path.join(ROOT, 'game'), path.join(OUT, 'game'));
  const shotDir = path.join(ROOT, 'screenshots');
  if (fs.existsSync(shotDir)) copyTree(shotDir, path.join(OUT, 'screenshots'));
  const dossier = buildDossier();
  fs.writeFileSync(path.join(OUT, 'dossier.json'), JSON.stringify(dossier, null, 2));
  const textBytes = dossier.textBytes as number;
  console.log(`SOLARA BAY dossier written to ${OUT}/dossier.json`);
  console.log(`files: ${(dossier.files as unknown[]).length}, text bytes: ${textBytes}, screenshots: ${(dossier.screenshots as unknown[]).length}`);
  if (textBytes > 150 * 1024) console.warn('WARNING: dossier text over 150 KiB — trim comments before submit.');
}

main();
