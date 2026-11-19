// SOLARA BAY — entrypoint dossier: salin game/ + screenshots/ ke output,
// tulis dossier.json via buildDossier kit (cap gate yang sama).
import { buildDossier } from "./vendor/makefun-game.ts";
import { cp, mkdir, writeFile } from "node:fs/promises";

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
await mkdir(outDir, { recursive: true });
await cp("game", outDir + "/game", { recursive: true, force: true });
await cp("screenshots", outDir + "/screenshots", { recursive: true, force: true });
const CAPS = {
  text_max_bytes: 163840,
  dossier_max_bytes: 1572864,
  game_max_bytes: 50331648,
  game_max_files: 993,
  index_max_bytes: 1048576,
  shot_max_bytes: 262144,
};
const dossier = await buildDossier(".", CAPS);
// buildDossier mengembalikan dossier.json sebagai bytes (Uint8Array) —
// tulis langsung, JANGAN JSON.stringify (akan mengacak byte jadi objek indeks).
await writeFile(outDir + "/dossier.json", dossier);
console.log("dossier written: " + outDir + "/dossier.json (" + dossier.length + " bytes)");
