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
    // Downtown in the late afternoon: wanted 3, two patrol cars on Ro's tail.
    G.timeOfDay = 17.2;
    const ride = spawnCar(G, 'sport', 0, -20, 0, 'player');
    ride.speed = 26;
    G.playerCar = ride;
    hero.onFoot = false;
    hero.car = ride;
    hero.pos.set(0, 0, -20);
    G.playerMesh.visible = false;
    G.wanted = 3;
    spawnPoliceCar(G);
    spawnPoliceCar(G);
    G.policeCars[0].x = -4;
    G.policeCars[0].z = -8;
    G.policeCars[0].yaw = 0;
    G.policeCars[0].speed = 24;
    G.policeCars[1].x = 5;
    G.policeCars[1].z = -30;
    G.policeCars[1].yaw = 0;
    G.policeCars[1].speed = 24;
    G.hud.showObjective('Courier Run — deliver parcel 1 to Calle Verde');
    G.camYaw = Math.PI;
    G.camPitch = 0.18;
    G.camDist = 7;
  } else if (name === 'drive') {
    // Golden hour on the coastal road: a sport car, traffic, walkers, the sea.
    G.timeOfDay = 18.4;
    const ride = spawnCar(G, 'sport', -240, 40, 0, 'player');
    ride.speed = 18;
    G.playerCar = ride;
    hero.onFoot = false;
    hero.car = ride;
    hero.pos.set(-240, 0, 40);
    G.playerMesh.visible = false;
    G.wanted = 0;
    G.hud.showObjective('Free roam — explore Solara Bay');
    G.camYaw = Math.PI;
    G.camPitch = 0.15;
    G.camDist = 7;
  } else if (name === 'street') {
    // Midday in the Old Solara market, on foot: crowds, an NPC, a prompt.
    G.timeOfDay = 12.0;
    hero.pos.set(0, 0, 132);
    hero.yaw = 0;
    hero.onFoot = true;
    G.playerMesh.position.copy(hero.pos);
    G.wanted = 0;
    for (let i = 0; i < 8; i++) {
      spawnPed(G, G.rng.range(-14, 14), 150 + G.rng.range(-12, 12));
    }
    const npc = spawnPed(G, 3, 144);
    npc.state = 'wait';
    G.mission.marker = { x: 3, z: 144 };
    G.mission.beacon.position.set(3, 0, 144);
    G.hud.showObjective('First Gear — steal the parked car (press E near it)');
    G.hud.showPrompt('E — Talk to Mara');
    G.camYaw = 0;
    G.camPitch = 0.1;
    G.camDist = 6;
  } else if (name === 'night') {
    // Marina Bay after dark: neon, headlights on, wanted 1, pier and wheel.
    G.timeOfDay = 22.0;
    const ride = spawnCar(G, 'sedan', -240, -6, -Math.PI / 2, 'player');
    ride.speed = 12;
    G.playerCar = ride;
    hero.onFoot = false;
    hero.car = ride;
    hero.pos.set(-240, 0, -6);
    G.playerMesh.visible = false;
    G.wanted = 1;
    spawnPoliceCar(G);
    G.lightsOn = true;
    G.hud.showObjective('Neon Nights — tail Kane\'s courier from the pier');
    G.camYaw = Math.PI / 2;
    G.camPitch = 0.16;
    G.camDist = 7;
  } else if (name === 'harbor') {
    // The Docks at dusk: harbor lights, Ro in a car on the dock road, wanted 2.
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
    G.mission.marker = { x: 216, z: 36 };
    G.mission.beacon.position.set(216, 0, 36);
    G.hud.showObjective('Harbor Lights — get down to the pier while the light lasts');
    // Chase camera sits behind the car (yaw + PI).
    G.camYaw = Math.PI;
    G.camPitch = 0.18;
    G.camDist = 7;
  }
  G.player.pos.y = 0;
  G.snapCamera = true;
  G.shotFrames = 0;
  G.shotName = name;
}
