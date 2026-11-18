# SOLARA BAY

An open-world crime game in a sun-soaked coastal city, built with three.js.
Play as **Ro Mendez**, a getaway driver back in Solara Bay, in debt to fixer
**Sal Vega** and hunting developer **Dario Kane** — steal cars, outrun the
police, and finish six story missions across six districts.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entered in the [make.fun bounty](https://make.fun/bounty/gta6-01) "Make GTA 6" ($1,666 in USDC, top 100).

## How to play

- **WASD** move / drive · **Mouse** look · **Shift** run / handbrake · **Space** jump
- **E** enter / steal a car (or exit it) · **Left click** punch / shoot
- **R** reload · **1 / 2** switch fists / pistol · **M** mute · **Esc** pause
- **C** camera distance · **F** headlights

Steal a car, lose the wanted stars by hiding or paying at Spray & Shine,
follow the yellow beacon to the next mission checkpoint. Money comes from
missions, taxi fares, stunt jumps, and 30 sun coins hidden around the city.
Progress saves automatically after each mission and at the garage.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — no build step, no network requests. three.js is vendored
under `game/vendor/`.

## Screenshots

- **1-chase.jpg** — afternoon downtown chase: wanted ★★★, two police cars,
  HUD with minimap, speed, and a mission objective.
- **2-drive.jpg** — golden-hour coastal road: sport car, traffic, pedestrians,
  and the sea.
- **3-street.jpg** — daytime Old Solara market on foot: Ro, pedestrians, and
  a mission prompt.
- **4-night.jpg** — Marina Bay at night: neon signs, headlights, wanted ★,
  the pier and the ferris wheel.

## The city

Six districts — Marina Bay, Old Solara, The Spires, The Docks, Vista Hills,
Calle Verde — with ~120 procedural buildings, traffic and pedestrians,
a wanted system with police cars and foot officers, 6 story missions, combat,
a day–night cycle with neon nights, and WebAudio synth sound and music.

All names, characters, vehicles, story, art, sounds, and music are original.
