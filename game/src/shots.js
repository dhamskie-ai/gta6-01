// Deterministic screenshot scenes (?shot=...&seed=8). Each sets player/car/
// police positions, wanted level, time of day and mission, so the shot shows
// several systems at once. main.js sets window.__shotReady after a few frames.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';

function placePlayerCar(S, x, z, yaw, type = 'sport', color = 0xd81e5b) {
  const car = createCarMesh(type, color);
  car.group.position.set(x, 0, z); car.group.rotation.y = yaw;
  car.driver = 'player'; car.speed = 18;
  S.scene.add(car.group); S.cars.push(car);
  S.player.inCar = true; S.player.car = car; S.player.mesh.visible = false;
  S.player.mesh.position.set(x, 0, z);
  S.player.yaw = yaw;
  return car;
}

export function setupShot(S, name) {
  const p = S.player;
  S.missions.active = false;
  if (name === 'chase') {
    // Cover: downtown dusk chase, 3 stars, 2 police cars, traffic, Spires.
    S.timeHours = 17.2;
    placePlayerCar(S, 80, -60, 0);
    S.police.wanted = 3;
    S.police.spawnPoliceCar(S); S.police.spawnPoliceCar(S);
    // Put both patrol cars visibly behind the player on the same road.
    S.police.cars.forEach((c, i) => {
      c.group.position.set(80 + (i === 0 ? -3 : 3), 0, -95 - i * 18);
      c.group.rotation.y = 0; c.speed = 26;
    });
    S.missions.current = 4; S.missions.stage = 2; S.missions.active = true;
    S.missions.placeBeacon({ x: -320, z: -40 });
    S.hud.setObjective('Bay Heist — Lose the heat and reach the pier');
    S.hud.showDialog('Kip', 'Three stars, Ro — the whole city is on you. Pier, now!');
  } else if (name === 'drive') {
    // Golden hour on the beach road, sport car, traffic, boardwalk peds.
    S.timeHours = 17.8;
    placePlayerCar(S, -262, 120, Math.PI, 'sport', 0xffd23f);
    S.hud.setObjective('SOLARA BAY — Malecón Celeste');
  } else if (name === 'street') {
    // Mission 2, Meet Marco: Ro on foot in Old Solara market, peds, prompt.
    S.timeHours = 10.5;
    p.mesh.position.set(-98, 0, -138); p.mesh.visible = true; p.yaw = Math.PI * 0.85;
    p.mesh.rotation.y = p.yaw;
    S.input.lookYaw = p.yaw - Math.PI;
    S.missions.current = 1; S.missions.stage = 0; S.missions.active = true; S.missions.timer = 240;
    S.missions.placeBeacon({ x: -80, z: -160 });
    S.hud.setObjective('Courier Run — Meet Marco at Marlin Ceviche (E — talk)');
    S.hud.showPrompt('E — Talk to Marco');
    S.player.weapon = 'pistol'; S.player.ammo = 12;
  } else if (name === 'night') {
    // Marina neon night, headlights on, 1 star, ferris wheel behind.
    S.timeHours = 21.5;
    placePlayerCar(S, -240, -60, Math.PI * 0.5, 'sedan', 0x3f7fd0);
    S.police.wanted = 1;
    S.hud.setObjective('Neon Nights — Tail the courier');
  } else if (name === 'touch') {
    // Touch controls visible, driving on the ring road.
    S.timeHours = 14;
    placePlayerCar(S, 300, 60, Math.PI / 2, 'taxi', 0xffd23f);
    document.getElementById('touch').style.display = 'block';
    S.hud.setObjective('SOLARA BAY — touch controls');
  } else if (name === 'road-zoom') {
    // Ring road zoomed out: dense traffic, buildings, palms.
    S.timeHours = 9.5;
    placePlayerCar(S, 160, 240, 0, 'van', 0x9aa5b1);
    S.renderer.camDist = 14;
    S.hud.setObjective('SOLARA BAY — ring road, Calle Verde');
  } else if (name === 'phone') {
    // Phone dialog bottom-right, vitals top-left, on foot near the pier.
    S.timeHours = 12;
    p.mesh.position.set(-260, 0, -20); p.mesh.visible = true; p.yaw = Math.PI * 0.5;
    p.mesh.rotation.y = p.yaw;
    S.input.lookYaw = p.yaw - Math.PI;
    S.hud.showDialog('Sal Vega', 'Ro, the Aurelia job is on. Mara has the garage ready, Kip has the route. Don’t keep Dario waiting — he hates waiting.');
    S.hud.setObjective('Bay Heist — Reach the penthouse garage');
    S.missions.current = 4; S.missions.stage = 0; S.missions.active = true;
    S.missions.placeBeacon({ x: 80, z: -80 });
  }
  // Make sure the camera is behind the action for the first frame.
  S.camera.position.set(p.mesh.position.x, 10, p.mesh.position.z + 14);
}
