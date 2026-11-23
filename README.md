# SOLARA BAY
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entered in the [make.fun bounty](https://make.fun/bounty/gta6-01) "Make GTA 6" ($1,666 in USDC, top 100).

**SOLARA BAY** is an open-world crime game in the browser: a sun-soaked
coastal city, a stolen hot-pink Veloz Comet RS, the PCPD on your tail, and
8 story missions from First Gear to the Golden Hour finale. Everything is
original — city, characters, cars, story, art and music. No Rockstar
names, assets or maps.

## The game

Nico is back in Solara Bay — broke, fast, and in debt to fixer **Sal Vega**.
Work jobs for wheelman **Marco**, client **Lupe**, hacker **Kip** and
mechanic **Mara Voss**, while developer **Dario Kane** buys up the Marina.
Steal cars on the Malecón, outrun the PCPD, and make Marco's boat before
the Golden Hour timer runs out.

- **Open city** — 640×640 m, 6 districts (Malecón Celeste, Marina Bay,
  The Spires, The Docks, Vista Hills, Calle Verde), ring roads, beach
  promenade, lighthouse, pier and ferris wheel.
- **Driving** — arcade physics, 8 car models (Cometa, Pip, Cabro taxi,
  Mula van, Veloz Comet RS sport, Hauler truck, Solara Bus, taco truck).
  E to enter / steal a car; stealing in front of the PCPD raises heat.
- **Wanted system** — 0–5 stars, PCPD patrol cars with flashing light
  bars and callsigns, foot cops, and a helicopter at 3+ stars. Hide to
  cool down, or pay Spray &amp; Shine $100/star.
- **8 missions** — First Gear, Meet Marco, Courier Run, The Docks Job,
  Neon Nights, Street Race, Beach Party, Golden Hour (107-second finale).
- **Side activities** — taxi fares, fishing at the pier, photo spots,
  30 sun coins, stunt jumps, a wandering street bonus.
- **Combat** — fists, VESPER pistol, MAKO SMG, BREAKER ($3,800), KESTREL
  (unlocked by mission 7). Guards and foot cops fight back.
- **Life** — 36 traffic cars, ~150 pedestrians, 24 parked cars, 22 birds,
  beach parties, bonfires, jetskis, neon at night, radio CELESTE 98.1.
- **Touch controls** — virtual joystick + MASUK / REM / KAM / TEMBAK /
  AKSI buttons on phones (`?touch=1` to preview on desktop).
- **Presentation** — full day/night cycle with a golden-hour sunset,
  HD facades (1024², per-building repeat), sharp geometry road markings,
  4096² ground, fog 220–1100 m, dynamic resolution scaling, quality
  settings (Low / Medium / High / Ultra) in the pause menu.

## How to play

```
node serve.ts            # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in a desktop browser. No network, no login,
no install — everything is local static files.

| Input | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run / brake (in car) |
| Space | Jump / handbrake (in car) |
| Mouse | Look around (click to lock) |
| E | Enter / steal car, talk, interact |
| 1–5 | Weapons (FISTS, VESPER, MAKO, BREAKER, KESTREL) |
| R | Reload (on foot) |
| C | Camera distance |
| M | Mute |
| F3 | FPS readout |
| Esc | Pause (save, quality, restart mission) |

Progress saves automatically after each mission (localStorage), and from
the pause menu.

## Screenshots

1. **Chase** — Golden Hour finale: the VELOZ at 112 km/h, 4 PCPD units
   and the helicopter, wanted ★★★★, sunset over the Malecón.
2. **Drive** — golden-hour cruise down the Malecón past the lighthouse.
3. **Street** — Nico meets Marco at Marlin Ceviche.
4. **Night** — neon, headlights and a PCPD patrol on the coast road.

## Tech

three.js (vendored `game/vendor/three.module.min.js`), plain ES modules,
procedural everything (canvas textures, instanced geometry, WebAudio
synth — no image/audio/font files). Seeded RNG (`?seed=`, default 1);
deterministic shot scenes live in `game/src/shots.js` (`?shot=chase` …).
Screenshots are taken with `tools/shot.mjs`, playtests with
`tools/playtest.mjs`.

## License

MIT — see [LICENSE](LICENSE).
