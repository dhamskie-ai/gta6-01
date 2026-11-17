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
    // Two police cars converging ahead of the player's car.
    const pc1 = spawnCar(G, 'sedan', 10, 22, 0, { police: true });
    pc1.isPolice = true; G.policeCars.push(pc1);
    const pc2 = spawnCar(G, 'sedan', -12, 28, 0, { police: true });
    pc2.isPolice = true; G.policeCars.push(pc2);
    for (const [t, x, z] of extra) spawnCar(G, t, x, z, G.rng.range(0, 6));
    p.camYaw = Math.PI; p.camPitch = 0.3; p.camDist = 12;
    G.hud.setObjective('Courier Run — Antar paket 1/3 ke The Spires');
    G.hud.setPrompt('');
  } else if (scene === 'drive') {
    G.timeOfDay = 17.75;
    p.pos.set(-240, 0, -40);
    const car = spawnCar(G, 'sport', -240, -40, 0, { owned: true });
    p.car = car; p.onFoot = false;
    p.cash = 860;
    startMission(G, 0);
    G.wanted = 0;
    for (const [t, x, z, yaw] of [['sedan', -237, -90, 0], ['taxi', -243, 30, Math.PI], ['hatch', -237, -140, 0]]) {
      spawnCar(G, t, x, z, yaw);
    }
    // Pedestrians on the boardwalk.
    for (let i = 0; i < 6; i++) {
      const ped = G.peds[i];
      ped.mesh.position.set(-272 + G.rng.range(-4, 4), 0, -100 + i * 22);
    }
    p.camYaw = 0; p.camPitch = 0.24; p.camDist = 11;
    G.hud.setObjective('First Gear — Kendarai ke bengkel Mara');
  } else if (scene === 'street') {
    G.timeOfDay = 12.0;
    p.pos.set(-30, 0, 0);
    p.car = null; p.onFoot = true;
    p.cash = 450;
    p.pistolOwned = true; p.weapon = 'pistol'; p.ammo = 12;
    startMission(G, 0);
    G.wanted = 0;
    // Pedestrians on the sidewalks along road z=0.
    for (let i = 0; i < 8; i++) {
      const ped = G.peds[i];
      ped.mesh.position.set(-55 + i * 7, 0, i % 2 === 0 ? 8.5 : -8.5);
    }
    // Mara stands nearby as the mission NPC.
    const mara = G.talkNpcs[0];
    mara.mesh.position.set(-27, 0, 2);
    p.camYaw = Math.PI; p.camPitch = 0.3; p.camDist = 8;
    G.hud.setObjective('First Gear — Jalan kaki ke mobil parkir di utara');
    G.hud.setPrompt('E — Bicara dengan Mara Voss');
  } else if (scene === 'night') {
    G.timeOfDay = 22.0;
    p.pos.set(-258, 0, 55);
    const car = spawnCar(G, 'sedan', -258, 55, Math.PI / 2, { owned: true });
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
