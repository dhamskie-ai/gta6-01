// Scene deterministik ?shot= + window.__shotReady + window.__game.
import { G } from './config.js';
import { spawnVehicle } from './vehicles.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { distToMissionCar } from './player.js';
let frames = 0;
export function setupShot() {
  const q = new URLSearchParams(location.search);
  G.shot = q.get('shot') || '';
  if (!G.shot) return;
  G.state = 'playing';
  document.getElementById('title').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  const placeCar = (x, z, heading) => {
    const v = G.vehicles.find((x) => x.type === 'sport' && x.parked) || spawnVehicle('sport', x, z, heading, { parked: true });
    v.x = x; v.z = z; v.heading = heading; v.mesh.position.set(x, 0, z); v.mesh.rotation.y = heading;
    return v;
  };
  if (G.shot === 'chase') {
    G.timeOfDay = 18.3; G.day = 1;
    const v = placeCar(0, 60, Math.PI);
    G.player.x = 0; G.player.z = 60; G.player.yaw = Math.PI; G.camYaw = Math.PI;
    v.parked = false; G.car = v; v.speed = 22;
    startMission(2); addWanted(3, '');
    // Polisi di-spawn 40–50 m di belakang (bukan 18 m) supaya mereka
    // terlihat mendekat di HUD saat capture, bukan sudah menempel.
    spawnVehicle('police', 6, 100, Math.PI, { callsign: 'PELICAN-11' });
    spawnVehicle('police', -6, 112, Math.PI, { callsign: 'GECKO-25' });
  } else if (G.shot === 'drive') {
    G.timeOfDay = 17.5;
    const v = placeCar(-240, 0, Math.PI / 2);
    G.player.x = -240; G.player.z = 0; G.player.yaw = Math.PI / 2; G.camYaw = Math.PI / 2;
    v.parked = false; G.car = v; v.speed = 18;
    startMission(1);
  } else if (G.shot === 'street') {
    G.timeOfDay = 12;
    G.player.x = -250; G.player.z = 46; G.player.yaw = Math.PI / 2; G.camYaw = Math.PI / 2;
    startMission(1);
    G.dialog = { name: 'Marco', role: 'SMUGGLER · WHEELMAN', text: 'Marlin Ceviche, Malecón. Aku tunggu di meja luar — jangan telat.', until: 9999 };
  } else if (G.shot === 'night') {
    G.timeOfDay = 21;
    const v = placeCar(120, 120, Math.PI);
    G.player.x = 120; G.player.z = 120; G.player.yaw = Math.PI; G.camYaw = Math.PI;
    v.parked = false; G.car = v; v.speed = 12;
    startMission(4); addWanted(1, '');
  } else if (G.shot === 'harbor') {
    G.timeOfDay = 18.4;
    G.player.x = -280; G.player.z = 0; G.player.yaw = -Math.PI / 2; G.camYaw = -Math.PI / 2;
    startMission(7);
  }
  G.objective = G.objective || 'Jelajahi Solara Bay';
}
export function shotTick() {
  if (!G.shot) return;
  frames++;
  if (frames === 12) window.__shotReady = true;
}
export function exposeGame() {
  window.__game = {
    ready: G.ready, state: G.state, px: G.player.x, pz: G.player.z,
    driving: !!G.car, car: G.car ? G.car.name : null,
    speed: G.car ? Math.round(Math.abs(G.car.speed) * 3.6) : 0,
    distToMissionCar: distToMissionCar(), wanted: G.wanted, cash: G.cash,
    mission: G.missionIdx, step: G.missionStep, health: G.health,
    taxi: G.taxi, race: G.race, fishing: G.fishing, photos: G.photos.length, fish: G.fish.length,
    audio: window.__audio || null, yaw: G.player.yaw, camYaw: G.camYaw,
    prompt: G.prompt, toast: G.toast,
    calls: G.renderer ? G.renderer.info.render.calls : 0,
    tris: G.renderer ? G.renderer.info.render.triangles : 0,
  };
}
