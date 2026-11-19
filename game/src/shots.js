// Staged ?shot= scenes for the dossier screenshots: arrange the world,
// then raise __shotReady once a few frames have settled.
import { spawnCar } from './vehicles.js';
import { spawnPoliceCar } from './police.js';
import { spawnPed } from './traffic.js';
export function setupShot(G, name) {
  const hero = G.player;
  G.phase = 'play';
  G.hud.el.classList.add('on');
  G.hud.title.style.display = 'none';
  G.mission.state = 'active';
  G.mission.index = 1;
  G.mission.step = 0;
  G.mission.marker = { x: 60, z: 60 };
  G.mission.beacon.position.set(60, 0, 60);
  G.mission.beacon.visible = true;
  if (name === 'chase') {
    G.timeOfDay = 17.2;
    const ride = spawnCar(G, 'sport', 0, -20, 0, 'player');
    ride.speed = 26;
    G.playerCar = ride;
    hero.onFoot = false;
    hero.car = ride;
    hero.pos.set(0, 0, -20);
    G.playerMesh.visible = false;
    G.wanted = 3;
    G.mission.timer = 126;
    spawnPoliceCar(G);
    spawnPoliceCar(G);
    G.policeCars[0].x = -4;
    G.policeCars[0].z = -8;
    G.policeCars[0].yaw = 0;
    G.policeCars[0].speed = 24;
    G.policeCars[1].x = 8;
    G.policeCars[1].z = -6;
    G.policeCars[1].yaw = 0;
    G.policeCars[1].speed = 24;
    const bus = spawnCar(G, 'bus', 2, 34, 0, 'traffic');
    bus.speed = 8;
    bus.cruise = 8;
    bus.axis = 'z'; bus.dir = 1;
    G.trafficCars.push(bus);
    G.hud.showObjective('Courier Run — deliver parcel 1 to Calle Verde');
    G.camYaw = Math.PI;
    G.camPitch = 0.18;
    G.camDist = 7;
  } else if (name === 'drive') {
    G.timeOfDay = 18.4;
    const ride = spawnCar(G, 'sport', -240, -60, 0, 'player');
    ride.speed = 18;
    G.playerCar = ride;
    hero.onFoot = false;
    hero.car = ride;
    hero.pos.set(-240, 0, -60);
    G.playerMesh.visible = false;
    G.wanted = 0;
    const bus = spawnCar(G, 'bus', -242.5, 20, 0, 'traffic');
    bus.speed = 8;
    bus.cruise = 8;
    bus.axis = 'z'; bus.dir = 1;
    G.trafficCars.push(bus);
    G.hud.showObjective('Free roam — explore Solara Bay');
    G.camYaw = Math.PI;
    G.camPitch = 0.15;
    G.camDist = 7;
  } else if (name === 'street') {
    G.mission.index = 0;
    G.timeOfDay = 12.0;
    hero.pos.set(0, 0, 132);
    hero.yaw = 0;
    hero.onFoot = true;
    G.playerMesh.position.copy(hero.pos);
    G.wanted = 0;
    for (let i = 0; i < 6; i++) {
      spawnPed(G, G.rng.range(-14, 14), 96 + G.rng.range(-10, 10));
    }
    for (let i = 0; i < 3; i++) {
      const chatter = spawnPed(G, 8 + G.rng.range(-1.5, 1.5), 100 + G.rng.range(-1.5, 1.5));
      if (chatter) { chatter.state = 'chat'; chatter.chatX = 8; chatter.chatZ = 100; }
    }
    const snapper = spawnPed(G, -9, 99);
    if (snapper) { snapper.state = 'selfie'; snapper.yaw = 0; }
    const sitter = spawnPed(G, -4, 138);
    if (sitter) { sitter.state = 'sit'; sitter.yaw = Math.PI; }
    const npc = spawnPed(G, 3, 102);
    if (npc) npc.state = 'wait';
    G.mission.marker = { x: 3, z: 102 };
    G.mission.beacon.position.set(3, 0, 102);
    G.hud.showObjective('First Gear — steal the parked car (press E near it)');
    G.hud.showPrompt('E — Talk to Mara');
    G.camYaw = 0;
    G.camPitch = 0.1;
    G.camDist = 6;
  } else if (name === 'night') {
    G.mission.index = 3;
    G.timeOfDay = 22.0;
    const ride = spawnCar(G, 'sedan', -240, 46, -Math.PI / 2, 'player');
    ride.speed = 12;
    G.playerCar = ride;
    hero.onFoot = false;
    hero.car = ride;
    hero.pos.set(-240, 0, 46);
    G.playerMesh.visible = false;
    G.wanted = 1;
    spawnPoliceCar(G);
    G.lightsOn = true;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const dancer = spawnPed(G, -280 + Math.cos(a) * 3.2, 60 + Math.sin(a) * 3.2);
      if (dancer) dancer.state = 'dance';
    }
    G.hud.showObjective('Neon Nights — tail Kane\'s courier from the pier');
    G.camYaw = Math.PI / 2;
    G.camPitch = 0.16;
    G.camDist = 7;
  } else if (name === 'harbor') {
    G.mission.index = 5;
    G.timeOfDay = 19.5;
    const ride = spawnCar(G, 'sedan', 240, 30, 0, 'player');
    ride.speed = 10;
    G.playerCar = ride;
    hero.onFoot = false;
    hero.car = ride;
    hero.pos.set(240, 0, 30);
    G.playerMesh.visible = false;
    G.wanted = 2;
    spawnPoliceCar(G);
    G.policeCars[0].x = 240;
    G.policeCars[0].z = 48;
    G.policeCars[0].yaw = 0;
    G.policeCars[0].speed = 12;
    spawnCar(G, 'foodtruck', 228, 12, Math.PI / 2, 'parked');
    spawnCar(G, 'bus', 214, 58, 0, 'parked');
    G.mission.marker = { x: 216, z: 36 };
    G.mission.beacon.position.set(216, 0, 36);
    G.hud.showObjective('Harbor Lights — get down to the pier while the light lasts');
    G.camYaw = Math.PI;
    G.camPitch = 0.18;
    G.camDist = 7;
  }
  G.player.pos.y = 0;
  G.snapCamera = true;
  G.shotFrames = 0;
  G.shotName = name;
}
