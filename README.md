# SOLARA BAY

Open-world crime game 3D (three.js, offline, static files) — make.fun
competition `gta6-01`. Play as Nico, back in Solara Bay: steal cars, outrun
the PCPD, run 8 jobs for Marco and Lupe — taxi fares, street races, fishing
off the pier, and photos of 6 hidden spots. Radio: CELESTE 98.1.

## Play

```
node serve.ts
```

Open http://localhost:8080 — desktop Chrome, keyboard + mouse. Touch
controls appear on touch devices (or `?touch=1`).

## Controls

WASD walk · Shift run · Space jump · E enter/exit car / talk · H horn ·
M mute · 1/2/3 weapons · R reload (on foot) / race (in car) · T taxi ·
F fish · P photo · K courier · C camera · Esc pause.

## World (round 6j)

- City 640×640 m, 5×5 road grid + east ring road (x=312) + south ring road
  (z=312) + beach promenade (x=-258, pedestrians only).
- 36 traffic cars, ~150 pedestrians, 24 parked cars, 22 birds, denser
  skyline (3–4 buildings per block, 2 Spires towers, 4 Plaza landmark
  towers 60–90 m), second palm row on the Malecón, 24 shade trees.
- HD kept from 6g/6i: 4096² ground texture, geometry road markings
  (InstancedMesh dashes/edges/zebras), 1024² facades with per-building UV
  repeat, fog 220–1100, pixelRatio cap 2.
- 8 missions, wanted 0–5 with PCPD cars, foot cops and heli, Spray &
  Shine respray, combat (fists / VESPER 72 / MAKO SMG), guards, save in
  localStorage (`solarabay-save-v1`).

## Shots

```
node tools/shot.mjs all
```

7 scenes: chase, drive, street, night, touch, road-zoom, phone
(390×844). See `shots.json`.

## Dossier

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licensed. All names, characters, vehicles, story, art, sound and
music are original — no Rockstar content.
