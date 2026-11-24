# SOLARA BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLARA BAY** — an open-world crime game for the make.fun bounty
[gta6-01](https://make.fun/bounty/gta6-01): "Make GTA 6". Walk the crowded
sidewalks, steal a car at a red light, outrun the police along the beach
road, lose the stars, and work off a debt to fixer Sal Vega.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: static files only. Keyboard + mouse on desktop,
touch controls on mobile (`?touch=1` forces them).

## The game

You are **Ro Mendez**, a getaway driver back in Solara Bay after five years
away, in debt to fixer **Sal Vega**. Hacker **Kip** talks you through jobs on
the phone, mechanic **Mara Voss** keeps your cars, and developer **Dario Kane**
is buying up the Marina. Wheelman **Marco** meets you in Old Solara.

- **City:** ~600×600 m, 6 districts — Marina Bay, Old Solara, The Spires,
  The Docks, Vista Hills, Calle Verde. Malecón Celeste beach promenade,
  boardwalk, pier, ferris wheel, ring roads, lighthouse.
- **Driving:** arcade physics, 6 procedural car models (Cometa sedan, Pip
  hatchback, Cabro taxi, Mula van, Veloce GT sport, Hauler truck). Steal any
  car with **E**.
- **World life (dense):** 36 traffic cars, ~150 pedestrians, 24 parked cars,
  22 birds, palm rows, shade trees, shop signs and neon — busy streets,
  HD look, capped pixel ratio for smooth play.
- **Wanted:** 0–5 stars. Foot cops at 1 star, patrol cars at 2+. Hide for
  20 seconds or pay Spray & Shine $100 per star.
- **5 story missions:** First Gear, Courier Run (meet Marco), The Docks Job,
  Neon Nights, Bay Heist — plus taxi fares, stunt jumps, 30 sun coins and a
  3-car garage.
- **Combat:** fists, pistol, enemies of Dario Kane, health + armor, Cal's Guns.
- **HUD + minimap:** health, armor, cash, wanted stars, speed, weapon,
  in-game clock, mission objective, context prompts. Radio **CELESTE 98.1**.
- **Save:** autosave after each mission and at the garage, localStorage only.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click to lock) |
| Shift | Run / handbrake |
| Space | Jump |
| E | Enter / exit / steal car, talk, interact |
| Left click | Punch / shoot |
| 1–2 | Weapons |
| R | Reload |
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
