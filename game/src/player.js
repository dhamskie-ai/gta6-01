// Ro Mendez on foot: procedural low-poly character, WASD + jump, third-
// person chase camera, car stealing (E), enter/exit.
import * as THREE from 'three';
import { CONFIG, CAR_TYPES } from './config.js';
import { collideBuildings, clampWorld } from './city.js';

export function createPlayerMesh(scene) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3fd2c0 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b3a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirt);
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
  head.position.y = 1.85; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.48), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 2.1; g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), pants);
  legL.position.set(-0.18, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armL.position.set(-0.48, 1.2, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.48; g.add(armR);
  g.position.set(-96, 0, -96);
  g.traverse((o) => { o.castShadow = true; });
  scene.add(g);
  const player = { mesh: g, legL, legR, armL, armR, walkPhase: 0 };
  return player;
}

export function updateOnFoot(S, dt) {
  const p = S.player, input = S.input;
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
  let fx = 0, fz = 0;
  if (input.down('KeyW') || input.touchVec.y < -0.3) fz -= 1;
  if (input.down('KeyS') || input.touchVec.y > 0.3) fz += 1;
  if (input.down('KeyA') || input.touchVec.x < -0.3) fx -= 1;
  if (input.down('KeyD') || input.touchVec.x > 0.3) fx += 1;
  // Camera-relative movement: camera yaw follows the mouse look yaw.
  const yaw = input.lookYaw + Math.PI;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  let mx = 0, mz = 0;
  if (fx || fz) {
    const len = Math.hypot(fx, fz); fx /= len; fz /= len;
    mx = (fx * cos - fz * sin); mz = (-fx * sin - fz * cos);
    p.yaw = Math.atan2(mx, mz);
    p.mesh.rotation.y = p.yaw;
    p.mesh.position.x += mx * speed * dt;
    p.mesh.position.z += mz * speed * dt;
    p.walkPhase += dt * (run ? 14 : 9);
    const swing = Math.sin(p.walkPhase) * 0.55;
    p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing; p.armR.rotation.x = swing;
  } else {
    p.legL.rotation.x *= 0.8; p.legR.rotation.x *= 0.8;
    p.armL.rotation.x *= 0.8; p.armR.rotation.x *= 0.8;
  }
  if (input.wasPressed('Space') || input.touch.jump) {
    if (p.velY === 0) { p.velY = CONFIG.jumpSpeed; S.audio.click(); }
  }
  if (p.velY !== 0 || p.mesh.position.y > 0) {
    p.velY -= CONFIG.gravity * dt;
    p.mesh.position.y += p.velY * dt;
    if (p.mesh.position.y <= 0) { p.mesh.position.y = 0; p.velY = 0; }
  }
  collideBuildings(S.city.colliders, p.mesh.position, 0.7);
  clampWorld(p.mesh.position);
  // Marco NPC proximity for mission 2 stage 0.
  const marco = S.traffic.marco;
  if (marco && S.missions.active && S.missions.current === 1 && S.missions.stage === 0) {
    const d = Math.hypot(p.mesh.position.x - marco.position.x, p.mesh.position.z - marco.position.z);
    p.nearMarco = d < 5;
    if (p.nearMarco) S.hud.showPrompt('E — Talk to Marco');
  }
}

// E: exit car, or steal the nearest car in range (driver pulled out for
// traffic cars; stealing in front of police adds a wanted star).
export function tryStealCar(S) {
  const p = S.player;
  if (p.inCar && p.car) {
    p.inCar = false;
    p.mesh.position.copy(p.car.group.position).add(new THREE.Vector3(2, 0, 0));
    p.mesh.visible = true;
    p.car.driver = 'parked';
    p.car = null;
    S.audio.engineStop();
    return;
  }
  let best = null, bestD = CONFIG.carEnterRange;
  for (const car of S.cars) {
    const d = car.group.position.distanceTo(p.mesh.position);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  const wasTraffic = best.driver === 'traffic';
  best.driver = 'player';
  p.inCar = true; p.car = best; p.mesh.visible = false;
  p.yaw = best.group.rotation.y;
  S.stats.stolen++;
  S.audio.engineStart();
  S.hud.showPrompt(`Stole the ${CAR_TYPES[best.type].name}`);
  if (wasTraffic) S.police.addWanted(S, CONFIG.stealHeat);
  // Mission 1: stealing the parked Cometa advances the objective.
  if (S.missions.active && S.missions.current === 0 && S.missions.stage === 0) S.missions.advance();
  if (S.missions.active && S.missions.current === 4 && S.missions.stage === 1 && best.isShowCar) S.missions.advance();
  if (S.missions.active && S.missions.current === 2 && S.missions.stage === 1 && best.type === 'truck') S.missions.advance();
  // Mission 2 stage 0: talking to Marco.
  if (S.missions.active && S.missions.current === 1 && S.missions.stage === 0 && p.nearMarco) {
    S.hud.showDialog('Marco', 'Parcels are in the Pip, Ro. Three drops, four minutes. Don’t scratch my paint.');
    S.missions.advance();
  }
  // Garage: parking a stolen car stores it.
  const gp = { x: 96, z: -64 };
  if (Math.hypot(best.group.position.x - gp.x, best.group.position.z - gp.z) < 10 && S.missions.garage.length < CONFIG.garageSlots) {
    S.missions.garage.push(best.type);
    S.saveGame();
    S.hud.showPrompt('Car stored in the garage');
  }
}
