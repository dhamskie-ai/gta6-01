// Deterministic screenshot scenes (?shot=chase|drive|street|night).
// Each scene sets up the world, then sets window.__shotReady after 2-3
// frames so Playwright can capture a settled render.
import * as THREE from 'three';
import { spawnCar } from './vehicles.js';
import { startMission } from './missions.js';

export function applyShot(G, scene) {
  const p = G.player;
  G.phase = 'play';
  document.getElementById('title-screen').style.display = 'none';
  // Extra traffic near the player for busy frames.
  const extra = [
    ['sedan', 12, -8], ['hatch', -14, 10], ['taxi', 20, 30], ['van', -20, -25],
  ];
  if (scene === 'chase') {
    G.timeOfDay = 16.5;
    p.pos.set(0, 0, 0);
    const car = spawnCar(G, 'sport', 0, 0, Math.PI, { owned: true });
    p.car = car; p.onFoot = false;
    p.cash = 1240;
    startMission(G, 1);
    G.wanted = 3;
    // Two police cars right behind.
    const pc1 = spawnCar(G, 'sedan', 10, 18, Math.PI, { police: true });
    pc1.isPolice = true; G.policeCars.push(pc1);
    const pc2 = spawnCar(G, 'sedan', -12, 24, Math.PI, { police: true });
    pc2.isPolice = true; G.policeCars.push(pc2);
    for (const [t, x, z] of extra) spawnCar(G, t, x, z, G.rng.range(0, 6));
    p.camYaw = Math.PI; p.camPitch = 0.28; p.camDist = 11;
    G.hud.setObjective('Courier Run — Antar paket 1/3 ke The Spires');
    G.hud.setPrompt('');
  } else if (scene === 'drive') {
    G.timeOfDay = 17.75;
    p.pos.set(-250, 0, -40);
    const car = spawnCar(G, 'sport', -250, -40, Math.PI / 2, { owned: true });
    p.car = car; p.onFoot = false;
    p.cash = 860;
    startMission(G, 0);
    G.wanted = 0;
    for (const [t, x, z] of [['sedan', -238, -90], ['taxi', -238, 30], ['hatch', -262, -140]]) {
      spawnCar(G, t, x, z, 0);
    }
    // Pedestrians on the boardwalk.
    for (let i = 0; i < 6; i++) {
      const ped = G.peds[i];
      ped.mesh.position.set(-272 + G.rng.range(-4, 4), 0, -100 + i * 22);
    }
    p.camYaw = Math.PI / 2; p.camPitch = 0.22; p.camDist = 10;
    G.hud.setObjective('First Gear — Kendarai ke bengkel Mara');
  } else if (scene === 'street') {
    G.timeOfDay = 12.0;
    p.pos.set(-40, 0, 20);
    p.car = null; p.onFoot = true;
    p.cash = 450;
    p.pistolOwned = true; p.weapon = 'pistol'; p.ammo = 12;
    startMission(G, 0);
    G.wanted = 0;
    for (let i = 0; i < 8; i++) {
      const ped = G.peds[i];
      ped.mesh.position.set(-60 + G.rng.range(-14, 14), 0, 0 + G.rng.range(-14, 14));
    }
    // Mara stands nearby as the mission NPC.
    const mara = G.talkNpcs[0];
    mara.mesh.position.set(-34, 0, 14);
    p.camYaw = Math.PI * 0.85; p.camPitch = 0.3; p.camDist = 7;
    G.hud.setObjective('First Gear — Jalan kaki ke mobil parkir di utara');
    G.hud.setPrompt('E — Bicara dengan Mara Voss');
  } else if (scene === 'night') {
    G.timeOfDay = 22.0;
    p.pos.set(-260, 0, 40);
    const car = spawnCar(G, 'sedan', -260, 40, Math.PI / 2, { owned: true });
    p.car = car; p.onFoot = false;
    p.cash = 2100;
    startMission(G, 4);
    G.wanted = 1;
    for (let i = 0; i < 4; i++) {
      const ped = G.peds[i];
      ped.mesh.position.set(-270 + G.rng.range(-6, 6), 0, 10 + i * 16);
    }
    p.camYaw = Math.PI / 2; p.camPitch = 0.24; p.camDist = 10;
    G.hud.setObjective('Bay Heist — Antar ke dermaga Marina');
  }
  // Headlights on at night.
  if (G.isNight || G.timeOfDay > 19 || G.timeOfDay < 6) enableHeadlights(G);
  G.shotFrames = 0;
  G.shotPending = true;
}

// Headlight spotlights on the player's car.
export function enableHeadlights(G) {
  if (!G.player.car) return;
  if (G.headlight) { G.headlight.visible = true; return; }
  const light = new THREE.SpotLight(0xfff2c8, 60, 40, 0.5, 0.4, 1.2);
  light.position.set(0, 1.2, -2);
  G.player.car.mesh.add(light);
  const target = new THREE.Object3D();
  target.position.set(0, 0, -14);
  G.player.car.mesh.add(target);
  light.target = target;
  G.headlight = light;
}

export function disableHeadlights(G) {
  if (G.headlight) G.headlight.visible = false;
}
