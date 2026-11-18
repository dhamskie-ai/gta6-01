# SOLARA BAY

A 3D open-world crime game set in a bright coastal city, made with three.js.
You play **Ro Mendez**, a getaway driver who has come home to Solara Bay
owing money to fixer **Sal Vega** — and with a score to settle against
developer **Dario Kane**. Lift cars, shake off the police, and work through
six story missions across six districts.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

This is an entry for the [make.fun bounty](https://make.fun/bounty/gta6-01)
"Make GTA 6" ($1,666 in USDC, top 100).

## Playing

- **WASD** walk / drive · **Mouse** look around · **Shift** sprint / handbrake · **Space** jump
- **E** get into or steal a car (or climb back out) · **Left click** punch / fire
- **R** reload · **1 / 2** fists / pistol · **M** mute · **Esc** pause
- **C** pull the camera back · **F** headlights

Grab a car, then drop your wanted stars by laying low or paying for a new
paint job at Spray & Shine, and chase the yellow beacon to the next mission
checkpoint. Cash comes from missions, taxi fares, stunt jumps, and 30 sun
coins tucked around the city. Your progress is saved on its own after every
mission and whenever you roll into the garage.

## Running it

```sh
node serve.ts
# open http://localhost:8080
```

Static files and nothing else — no build step, no network calls. three.js
ships vendored under `game/vendor/`.

## Screenshots

- **1-chase.jpg** — a downtown chase in the afternoon: wanted ★★★, two
  police cars behind you, HUD with minimap, speed, and a mission objective.
- **2-drive.jpg** — a coastal road at golden hour: a sport car, traffic,
  pedestrians, and the sea beyond the boardwalk.
- **3-street.jpg** — an Old Solara market in daylight, on foot: Ro among
  pedestrians, with a mission NPC and a prompt.
- **4-night.jpg** — Marina Bay after dark: glowing signs, headlights,
  wanted ★, the pier and the ferris wheel.

## The city

Six districts — Marina Bay, Old Solara, The Spires, The Docks, Vista Hills,
Calle Verde — holding around 120 procedurally built buildings, moving
traffic and pedestrians, a wanted system with patrol cars and officers on
foot, 6 story missions, combat, a full day–night cycle with neon nights,
and synthesized WebAudio sound and music.

Every name, character, vehicle, story beat, piece of art, sound, and tune
is original.
