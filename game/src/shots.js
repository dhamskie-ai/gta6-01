// Deterministic screenshot scenes (?shot=…&seed=8). Each scene stages the
// world, then main.js sets window.__shotReady after a few frames.
import { G, CFG } from './config.js';
import { setWanted, spawnPoliceCar, spawnFootCop } from './police.js';
import { startMission } from './missions.js';
import { enterCar } from './player.js';
import { velozCar } from './vehicles.js';

function putPlayer(x, z, heading) {
  const p = G.player;
  p.x = x; p.z = z; p.heading = heading; p.car = null;
  p.group.visible = true;
  p.group.position.set(x, 0, z);
  p.group.rotation.y = heading;
}
function putVeloz(x, z, heading, speed = 0) {
  let v = G.cars.find((c) => c.isPlayerCar);
  if (!v) v = velozCar();
  v.x = x; v.z = z; v.heading = heading; v.speed = speed; v.hp = 100;
  v.group.position.set(x, 0, z); v.group.rotation.y = heading;
  return v;
}
function flankPolice() {
  const v = G.cars.find((c) => c.isPlayerCar);
  if (!v) return;
  spawnPoliceCar(v.x - 3.5, v.z - 6, 'KESTREL-31');
  spawnPoliceCar(v.x + 3.5, v.z + 7, 'BARRACUDA-18');
  for (const u of G.police) {
    if (u.kind !== 'car') continue;
    u.car.speed = 31; u.car.heading = Math.PI;
    u.car.group.position.set(u.car.x, 0, u.car.z);
    u.car.group.rotation.y = Math.PI;
  }
}
export function setupShot(scene) {
  G.shotMode = true; G.shotScene = scene;
  G.beaconOff = false;
  G.phase = 'play';
  const p = G.player;
  // Reset police between scenes.
  for (const u of [...G.police]) {
    if (u.kind === 'car') G.scene.remove(u.car.group);
    else G.scene.remove(u.group);
  }
  G.police = []; G.policeUnits = [];
  if (scene === 'chase') {
    G.timeOfDay = 18.0;
    const v = putVeloz(-240, 66, Math.PI, 31); // 112 km/h
    enterCar(v, null);
    setWanted(4);
    startMission(2); // Courier Run — JOB 3/8
    G.msn.stage = 1; G.msn.timer = 239; // 3:59
    G.msn.objective = 'Drop 2: The Docks';
    flankPolice();
    if (G.heli) G.heli.group.visible = true;
    G.camYaw = Math.PI;
  } else if (scene === 'drive') {
    G.timeOfDay = 17.5;
    const v = putVeloz(-240, 120, Math.PI, 19); // 68 km/h
    enterCar(v, null);
    startMission(0);
    G.camYaw = Math.PI;
  } else if (scene === 'street') {
    // Mission 2 — Meet Marco (NOT mission 1).
    G.timeOfDay = 12.0;
    putVeloz(-240, 66, Math.PI, 0);
    putPlayer(-240, 84, 0);
    startMission(1);
    G.msn.stage = 0;
    if (window.__hud) {
      window.__hud.showDialog('Marco', 'WHEELMAN', 'Marco: There you are. The boat job is tonight — Lupe is counting on us.', 30000);
      window.__hud.setPrompt('E — Bicara dengan Marco');
    }
    G.camYaw = 0;
    G.camDist = 7;
  } else if (scene === 'night') {
    G.timeOfDay = 21.0;
    const v = putVeloz(-252, 108, Math.PI * 0.5, 12); // 43 km/h
    enterCar(v, null);
    setWanted(1);
    startMission(4); // Neon Nights — JOB 5/8
    spawnFootCop(-248, 104, 'PELICAN-11');
    spawnFootCop(-256, 112, 'GECKO-25');
    G.camYaw = Math.PI * 0.5;
  } else if (scene === 'touch') {
    G.timeOfDay = 17.8;
    const v = putVeloz(-240, 100, Math.PI, 19);
    enterCar(v, null);
    startMission(1);
    G.beaconOff = true; // beacon column would cut through the driving shot
    G.camYaw = Math.PI;
  } else if (scene === 'road-zoom') {
    G.timeOfDay = 17.5;
    putVeloz(-236, 40, Math.PI, 0);
    putPlayer(-240, 52, Math.PI);
    startMission(2);
    G.camYaw = Math.PI; G.camDist = 5; G.camPitch = 0.12;
    G.beaconOff = true;
    if (window.__beaconOff) window.__beaconOff();
  } else if (scene === 'phone') {
    G.timeOfDay = 18.2;
    putPlayer(-258, 20, -Math.PI / 2); // facing the sunset, west
    startMission(7); // Golden Hour
    G.msn.timer = 107;
    if (window.__hud) {
      window.__hud.showDialog('Marco', 'WHEELMAN', "Marco: The boat sails in two minutes, Nico! Shake that chopper and get to the pier!", 30000);
    }
    G.camYaw = -Math.PI / 2; G.camDist = 6;
  }
  // Re-stage the street dialog every frame in shot mode (it times out
  // before SwiftShader finishes a frame); main.js re-calls stageShotDialog.
  G.shotFrames = 0;
}
export function stageShotDialog() {
  if (!G.shotMode) return;
  if (G.shotScene === 'street' && window.__hud) {
    window.__hud.showDialog('Marco', 'WHEELMAN', 'Marco: There you are. The boat job is tonight — Lupe is counting on us.', 30000);
    window.__hud.setPrompt('E — Bicara dengan Marco');
  }
  if (G.shotScene === 'phone' && window.__hud) {
    window.__hud.showDialog('Marco', 'WHEELMAN', "Marco: The boat sails in two minutes, Nico! Shake that chopper and get to the pier!", 30000);
  }
}
