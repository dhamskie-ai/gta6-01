# SOLARA BAY — Visual Upgrade Plan (applied in this build)

Target look: the reference frame Dham sent — a neon-soaked sunset chase:
pink sports car, police cars + helicopter, palm-lined boulevard, glowing
billboards, rich HUD (mission panel, police response list, circular minimap,
radio readout, big speedometer, character-portrait dialogue).

## What this build contains

- **Sharpness:** pixelRatio capped at 2, ACES filmic tone mapping, exposure
  1.12, ground texture 4096², facade textures 1024² with per-building UV
  repeat and anisotropy 16, road markings as separate InstancedMesh geometry
  (centre dashes, edge lines, zebra at every intersection), fog 220–1100.
- **Sunset atmosphere:** golden-hour sky keys (16:00 pale blue, 17:30 gold,
  18:30 orange, 19:20 pink dusk, 20:00 night), sun colour lerping to orange
  `0xff8f3d`, additive sun-glow sprite, 9 drifting clouds, hemisphere fill
  raised (day 1.15, night 0.35), night stars + moon.
- **Livelier world:** 3 facade variants with warmer dark windows, sidewalk
  strips + crosswalks in the ground texture, ~22 glowing shop signs, 8 neon
  signs (FLAMINGO FM pink, VICE HOTEL cyan, TACOS 24H yellow) with additive
  halos, merged-geometry palms in coast/plaza/avenue rows plus a second row,
  24 shade trees, traffic lights at 4 intersections, 22 circling birds.
- **Cars:** roof panel, slanted windshield, mirrors, bumpers, sport-only
  spoiler, hubcap discs. Veloz Comet RS paint: hot pink `0xff2e7e`.
- **Police:** split red/blue light bars, round-robin callsigns
  (IBIS-43, TARPON-10, HERON-17, KESTREL-31, MARLIN-26, OSPREY-08, …),
  roles RAMMING/PURSUIT/PATROL, helicopter at wanted ≥ 3 with searchlight.
- **HUD:** top-left mission panel (chapter, timer, objective, stage, next),
  vitals below it, top-right day/stars/cash/clock, PCPD response list,
  circular 200×200 minimap + district name + respect bar, portrait dialogue,
  radio CELESTE 98.1 with rotating tracks, big speedometer + car condition.
- **Density:** 36 traffic, ~150 pedestrians, 24 parked, 22 birds, 3–4
  buildings per block, 2 Spires + 4 Plaza towers, east + south ring roads,
  beach promenade, lighthouse, jetskis, bus + taco truck.

## Reference frames (HUD text mirrored, names re-themed)

- Mission panel: "GOLDEN HOUR · Lupe", timer 1:47, "Lose the manhunt before
  Marco's boat sails", "STAGE 4/5", "NEXT: Reach the boat at the pier".
- PCPD list: callsign + distance + tactic (RAMMING / PURSUIT / ROADBLOCK).
- Radio: CELESTE 98.1, "Malecón Mirage · Vela Roja". Car: VELOZ COMET RS.

## Verification

`node --check` on every src file, 7 screenshot scenes at seed 8
(1280×720, ≤256 KiB, 0 console/page errors), `tools/playtest.mjs`
desktop + touch, dossier via `MAKEFUN_OUTPUT_DIR=out node main.ts`.
No FPS claim is made — SwiftShader in this VM runs ~1 fps and is not
representative of real Chrome.
