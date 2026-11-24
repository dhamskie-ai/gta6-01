# SOLARA BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLARA BAY** — an open-world crime game for the make.fun bounty
[gta6-01](https://make.fun/bounty/gta6-01): "Make GTA 6". Drive, steal,
outrun the PCPD and finish 8 story jobs across a sunny coastal city.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: static files only. Keyboard + mouse on desktop,
touch controls on mobile (`?touch=1` forces them).

## The game

You are **Nico**, a getaway driver back in Solara Bay, in debt to fixer
**Sal Vega**. Wheelman **Marco**, mechanic **Mara Voss** and hacker **Kip**
help you work the debt off while developer **Dario Kane** buys up the Marina.
Client **Lupe** waits at the pier for the Golden Hour finale.

- **City:** 640×640 m — Malecón Celeste beach promenade, Old Solara market,
  The Spires downtown, The Docks, Vista Hills, Calle Verde. Ring roads east
  (x=312) and south (z=312), lighthouse, pier, ferris wheel, jetskis.
- **Driving:** arcade physics, 6 car models plus bus and taco truck. Steal
  any car with **E** — the hot-pink **Veloz Comet RS** is yours from the start.
- **Wanted:** 0–5 stars. PCPD patrol cars, foot cops and (3★+) a helicopter.
  Lose them, hide, or pay Spray & Shine $100/star.
- **8 missions:** First Gear, Meet Marco (Marlin Ceviche), Courier Run,
  Docks Job, Neon Nights, Street Race, Beach Party, Golden Hour (107 s finale).
- **Side work:** taxi fares, street racing, fishing at the pier, photo spots,
  30 sun coins, stunt jumps, a 3-car garage.
- **World life:** 36 traffic cars, ~150 pedestrians, 24 parked cars, 22 birds,
  palm rows, shade trees, shop signs and neon, day–night cycle with golden-hour
  sunset. Radio **CELESTE 98.1** — "Malecón Mirage · Vela Roja".
- **Combat:** fists, Vesper pistol, Mako SMG. **R** reloads on foot only.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click to lock) |
| Shift | Run / handbrake |
| Space | Jump |
| E | Enter / exit / steal car, talk, interact |
| Left click | Punch / shoot |
| 1–4 | Weapons |
| R | Reload (on foot) |
| C | Camera distance |
| M | Mute |
| Esc | Pause |

## Tech

three.js (vendored `game/vendor/three.module.min.js`), procedural art only —
canvas textures, no image/audio files. Deterministic seed (`?seed=8`);
screenshot scenes via `?shot=chase|drive|street|night|touch|road-zoom|phone`.

Screenshots: `tools/shot.mjs`. Playtest: `tools/playtest.mjs`.
Dossier: `MAKEFUN_OUTPUT_DIR=out node main.ts`.

License: MIT — see LICENSE.
