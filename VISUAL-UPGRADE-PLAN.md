# SOLARA BAY — Visual Upgrade Plan (round 7, implemented)

**Status:** IMPLEMENTED in the round-7 rebuild — this file is the plan the
builder worked from, alongside DESIGN.md and the reference frames.

**Goal:** more detail, a livelier world, a sharper image — look like the
reference frame: a neon-soaked sunset chase (pink sports car, police cars
+ helicopter, palm-lined boulevard, glowing billboards, rich HUD with
mission panel, police response list, circular minimap, radio readout,
big speedometer, character-portrait dialogue).

## Reference frame inventory (what "good" looks like)

- Warm pink/orange sunset sky, sun low, long soft shadows.
- Palm trees lining both sides of the boulevard, fronds visibly drooping.
- Big glowing signs (pink "FLAMINGO FM"-style billboard, cyan "HOTEL").
- Pink player sports car, black-and-white police cars with flashing
  red/blue light bars, helicopter overhead.
- HUD: top-left mission panel (chapter, timer, objective, stage);
  top-right money + wanted stars + day/time; police unit list under it;
  circular minimap bottom-left with district name + respect bar;
  dialogue with character portrait bottom-centre; radio + big speed
  bottom-right.

Reference frame 2 (the binding target): mission panel "GOLDEN HOUR · Lupe",
timer 1:47, "Lose the manhunt before Marco's boat sails", STAGE 4/5,
"NEXT: Reach the boat at the pier"; PCPD list (PELICAN-11, GECKO-25,
AIR-1, BARRACUDA-18, TAC-45, "+4 more units"); $86,250; minimap
"Malecón Celeste" + RESPECT SHOT CALLER; dialogue Marco (SMUGGLER ·
WHEELMAN); radio CELESTE 98.1 "Malecón Mirage · Vela Roja"; VELOZ COMET
RS 113 km/h G3.

## 1. render.js — sharpness + sunset atmosphere

- Pixel ratio cap 2; ACES filmic, exposure 1.05.
- Sky keys: gold→orange→pink ramp (16:00 pale blue, 17:30 gold,
  18:30 orange, 19:20 pink dusk, 20:00 night). Fog follows the sky.
- Sun colour lerps toward orange (0xff8f3d) at sunset with an intensity bump.
- Sun glow: large additive radial sprite tracking the sun direction.
- Clouds: 14 soft sprites drifting at y ≈ 110–170.
- Hemisphere fill raised (day 1.6) so shadows stop being pitch black.
- Day counter increments when timeOfDay wraps past 24.
- Night block drives neon-halo opacities (0.12 + nightFactor × 0.5).

## 2. city.js — a livelier, more detailed world

- Window textures: 6 facade variants (1024²), lighter dark windows.
- Ground texture 4096² with sidewalk strips + crosswalks at every
  intersection; anisotropy = renderer maximum.
- Storefronts: 22 glowing shop signs + awnings; 8 neon signs
  (FLAMINGO FM, VICE HOTEL, TACOS 24H, MARLIN CEVICHE…) with halos.
- Palms: one merged detailed geometry per palm (leaning 3-segment
  trunk, 10 drooping fronds, 3 coconuts), single InstancedMesh; rows on
  the coast, the plaza, and both avenues, plus a second staggered row.
- Traffic lights at 4 intersections (green 4 s → amber 1 s → red 4 s).
- Birds: 22, circling with flapping wings.
- 24 shade trees, street props (hydrants, benches, bins, planters),
  rooftop AC units, water towers, antennas, market stalls, beach
  umbrellas/towels, lifeguard tower, bonfire, lighthouse with rotating
  beam, pier, ferris wheel, 2 jetskis, 30 sun coins.

## 3. vehicles.js — detailed cars

- Body-colour roof panel, slanted glass windshield, side mirrors,
  front + rear bumpers, grille, front plate, rear spoiler (sport only),
  hubcaps. Sport paint hot pink 0xff2e7e (Veloz Comet RS).

## 4. police.js — light bars, callsigns, helicopter

- Light bar split red/blue, flashing in alternation.
- Callsigns round-robin (IBIS-43, TARPON-10, HERON-17, KESTREL-31,
  MARLIN-26, OSPREY-08, PELICAN-11, GECKO-25, BARRACUDA-18, TAC-45…);
  role RAMMING when close, PURSUIT otherwise, ROADBLOCK at wanted ≥ 4.
- Helicopter (body, stripe, glass, tail boom, rotors, beacon,
  searchlight cone) visible at wanted ≥ 3, orbiting at radius 26,
  height 14.

## 5. hud.js + index.html — Vice City-style HUD

- Mission panel top-left (chapter, timer, objective, stage, next).
- Vitals below it; top-right DAY n + stars + cash + clock + IN SIGHT.
- PCPD response list under the cluster (rebuilt every frame).
- Minimap 200×200, clipped to a circle; district name + respect bar.
- Dialogue: 56×56 portrait tile (initials on a hue gradient) +
  name/role + body.
- Radio CELESTE 98.1, track rotating every 25 s; big speedometer
  (44 px) + car-condition bar; jobs counter (taxi/fish/photos/coins).

## 6. config.js — density + paint

- trafficN 36, pedN 72 (+crowds to ~150), parkedN 24, birdN 22.
- Sport colour hot pink.

## 7. main.js + missions.js — state the HUD reads

- G.day starts at 1; stats.missionsDone increments on completion;
  respect = missionsDone + 1 (capped 5).
- 8 missions incl. Meet Marco (Marlin Ceviche, Malecón road) and
  Golden Hour finale (107 s timer, 5 steps, wanted 4 at escape).

## 8. shots.js — truthful mission panel per scene

- chase → mission 8 (Golden Hour), step 4/5, timer 1:47, wanted 4.
- street → mission 1 (First Gear), talk step, STAGE 2/3.
- night → mission 5 (Neon Nights); drive → free roam.

## HD rules (kept from rounds 6g/6i)

- Ground 4096², facade 1024² + RepeatWrapping + aniso 16, fog
  220–1100, pixelRatio cap 2, road markings as geometry (InstancedMesh).
- Meet point Marlin Ceviche (-240, 90) on the Malecón road (never inside
  a building footprint); Marco (-238, 64); spawn (-240, 80);
  VELOZ (-240, 66). Camera yaw = heading (chase behind the car).
- Headlight intensity 120; asphalt 0x3d434b.
