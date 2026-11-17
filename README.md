# SOLARA BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhamskie-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entered in the [make.fun bounty](https://make.fun/bounty/gta6-01) "Make GTA 6" ($1,666 in USDC, top 100).

**SOLARA BAY** is an original open-world crime game that plays offline in a desktop browser. Ro Mendez returns to the sun-soaked coastal city of Solara Bay after five years away, in debt to fixer Sal Vega. Work five story missions, hunt the developer Dario Kane, and pay the debt off — on foot and by stolen car, with the police never far behind.

Everything is original: the city, characters, vehicles, story, art, sound and music. No Rockstar names, logos, characters, maps or assets.

## How to play

- **WASD** — walk / drive · **Mouse** — look around · **Wheel / C** — camera distance
- **E** — steal / enter a car, exit a car, talk to NPCs, use shops
- **Shift** — run / handbrake · **Space** — jump
- **Click** — punch / shoot · **1 / 2** — fists / pistol · **R** — reload
- **F** — start a taxi fare (in a Cabro taxi) · **N** — next mission · **M** — mute · **Esc** — pause

## The city

Six districts across a 600×600 m coastal map: Marina Bay (pier + ferris wheel), Old Solara (market), The Spires (downtown towers), The Docks (containers + crane), Vista Hills, and Calle Verde. Traffic AI follows the road grid, pedestrians stroll the sidewalks (and flee gunfire), and a full day–night cycle turns the neon on after dark.

## Systems

- **Wanted 0–5 stars** — stealing, speeding past police, hitting pedestrians and shooting all raise heat; police cars and foot officers chase, ram and punch. Hide for 10 seconds to cool off, or pay Spray & Shine $100 per star.
- **5 story missions** — First Gear, Courier Run, The Docks Job, Neon Nights, Bay Heist — with briefings, checkpoints, a 3D beacon, timers and retries.
- **Side activities** — taxi fares, stunt jumps, 30 sun coins, a 3-car garage, health/armor pickups, a gun shop.
- **Combat** — fists + pistol, enemy guards with limited accuracy, car damage, smoke and explosions.
- **HUD + minimap** — health/armor, cash, wanted stars, speed, weapon, in-game clock, mission objective, and a 180×180 minimap with mission markers and police dots.
- **Save/load** — autosaves after every mission and at the garage, stored in localStorage.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, gunshots, horns, mission jingles and an ambient A-minor loop. No audio files.

## How to run

```bash
node serve.ts
# open http://localhost:8080
```

No build step, no network requests — every file the game loads sits under `game/` (three.js is vendored as `game/vendor/three.module.min.js` + `three.core.min.js`).

## Screenshots

1. **1-chase.jpg** — afternoon downtown chase: wanted ★★★, two police cars converging, mission marker on the HUD + minimap.
2. **2-drive.jpg** — golden-hour coastal road in the Veloce GT sport car, traffic and pedestrians on the boardwalk, sea and sunset.
3. **3-street.jpg** — daytime Old Solara market on foot, pedestrians, mission NPC Mara Voss and the talk prompt, pistol in hand.
4. **4-night.jpg** — Marina Bay at night: neon, headlights, wanted ★, the pier and ferris wheel.

## Tech

three.js (vendored), plain ES modules, seeded RNG (`?seed=`; default 1) for a deterministic city. Screenshot scenes are deterministic via `?shot=chase|drive|street|night`.
