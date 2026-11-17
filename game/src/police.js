// Wanted level 0-5 + police AI (patrol cars and foot officers).
import * as THREE from 'three';
import { CFG } from './config.js';
import { spawnCar, removeCar } from './vehicles.js';
import { makePedModel, scarePedestrians } from './traffic.js';
import { spawnParticles } from './render.js';

export function createPolice(G) {
  G.policeCars = [];
  G.footPolice = [];
  G.wanted = 0;
  G.heatTimer = 0;
  G.hiddenTimer = 0;
  G.lastWantedReason = '';
}

export function spawnPoliceCar(G) {
  const p = G.player.car ? G.player.car.mesh.position : G.player.pos;
  const angle = G.rng.range(0, Math.PI * 2);
  const x = THREE.MathUtils.clamp(p.x + Math.cos(angle) * 60, -260, 260);
  const z = THREE.MathUtils.clamp(p.z + Math.sin(angle) * 60, -260, 260);
  const car = spawnCar(G, 'sedan', x, z, 0, { police: true });
  car.mesh.children.forEach((c) => {
    if (c.material && c.material.color) {
      // White body for police cars.
      if (c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y < 1.1) {
        c.material = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
      }
    }
  });
  car.isPolice = true;
  car.sirenPhase = G.rng.range(0, 6);
  G.policeCars.push(car);
  return car;
}

export function spawnFootPolice(G) {
  const p = G.player.pos;
  const angle = G.rng.range(0, Math.PI * 2);
  const mesh = makePedModel(G.rng);
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  mesh.position.set(
    THREE.MathUtils.clamp(p.x + Math.cos(angle) * 25, -260, 260), 0,
    THREE.MathUtils.clamp(p.z + Math.sin(angle) * 25, -260, 260));
  G.scene.add(mesh);
  const cop = { mesh, hp: 40, speed: 4.2, punchCooldown: 0, walkPhase: 0 };
  G.footPolice.push(cop);
  return cop;
}

export function removePoliceCar(G, car) {
  const i = G.policeCars.indexOf(car);
  if (i >= 0) G.policeCars.splice(i, 1);
  removeCar(G, car);
}

export function removeFootPolice(G, cop) {
  const i = G.footPolice.indexOf(cop);
  if (i >= 0) G.footPolice.splice(i, 1);
  G.scene.remove(cop.mesh);
}

// Wanted stars: police numbers scale with stars; heat decays when hidden.
export function updateWantedLevel(G, dt) {
  const p = G.player;
  const playerPos = p.car ? p.car.mesh.position : p.pos;
  const wantedCars = G.wanted >= 2 ? Math.min(4, G.wanted - 1) : 0;
  const wantedFoot = G.wanted >= 1 ? Math.min(4, G.wanted + 1) : 0;
  while (G.policeCars.length < wantedCars) spawnPoliceCar(G);
  while (G.policeCars.length > wantedCars) removePoliceCar(G, G.policeCars[0]);
  while (G.footPolice.length < wantedFoot) spawnFootPolice(G);
  while (G.footPolice.length > wantedFoot) removeFootPolice(G, G.footPolice[0]);

  // Heat: if no police can see the player, the timer counts down.
  let seen = false;
  for (const car of G.policeCars) {
    const d = car.mesh.position.distanceTo(playerPos);
    if (d < 70) { seen = true; break; }
  }
  for (const cop of G.footPolice) {
    if (cop.mesh.position.distanceTo(playerPos) < 30) { seen = true; break; }
  }
  if (G.wanted > 0) {
    if (seen) { G.heatTimer = 0; G.hiddenTimer = 0; }
    else {
      G.hiddenTimer += dt;
      if (G.hiddenTimer > CFG.heatHideSec && G.wanted > 0) {
        G.wanted -= 1;
        G.hiddenTimer = 0;
        G.hud.setToast(`Wanted turun — ${G.wanted} bintang`);
      }
      if (G.hiddenTimer > CFG.heatClearSec) G.wanted = 0;
    }
  }
  G.audio?.setSiren(G.wanted >= 2 && G.policeCars.length > 0);
  updatePoliceCars(G, dt, playerPos);
  updateFootPolice(G, dt, playerPos);
}

function updatePoliceCars(G, dt, playerPos) {
  for (const car of [...G.policeCars]) {
    const p = car.mesh.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const dist = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(-dx, -dz);
    let dy = targetYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += THREE.MathUtils.clamp(dy, -1.8 * dt, 1.8 * dt);
    const wantSpeed = dist > 6 ? 30 : 8;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
    p.x += -Math.sin(car.yaw) * car.speed * dt;
    p.z += -Math.cos(car.yaw) * car.speed * dt;
    p.x = THREE.MathUtils.clamp(p.x, -295, 295);
    p.z = THREE.MathUtils.clamp(p.z, -295, 295);
    car.mesh.rotation.y = car.yaw;
    // Ram the player: damage on contact.
    if (dist < 3.2) {
      car.speed *= 0.4;
      if (G.player.car) {
        G.player.car.hp -= 6 * dt * 10;
        spawnParticles(G, { x: p.x, y: 1, z: p.z }, 0xffaa22, 2, 2, 2, 0.4);
      } else {
        damagePlayer(G, 12 * dt);
      }
      G.audio?.blip(120, 0.1, 'square', 0.12);
    }
    // Flashing light bar.
    car.sirenPhase += dt * 6;
    const bar = car.mesh.children.find((c) => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 1.4);
    if (bar) bar.material.color.setHex(Math.sin(car.sirenPhase) > 0 ? 0xff2222 : 0x2244ff);
  }
}

function updateFootPolice(G, dt, playerPos) {
  for (const cop of [...G.footPolice]) {
    const p = cop.mesh.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const dist = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    cop.mesh.rotation.y = yaw;
    if (dist > 1.6) {
      p.x += -Math.sin(yaw) * cop.speed * dt;
      p.z += -Math.cos(yaw) * cop.speed * dt;
      cop.walkPhase += dt * 8;
      const swing = Math.sin(cop.walkPhase) * 0.5;
      cop.mesh.userData.legL.rotation.x = swing;
      cop.mesh.userData.legR.rotation.x = -swing;
    } else if (G.player.onFoot) {
      cop.punchCooldown -= dt;
      if (cop.punchCooldown <= 0) {
        cop.punchCooldown = 1.1;
        damagePlayer(G, 8);
        spawnParticles(G, { x: playerPos.x, y: 1.4, z: playerPos.z }, 0xff4444, 4, 2, 2, 0.4);
        G.audio?.punch();
      }
    }
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, amount);
    p.armor -= absorbed;
    amount -= absorbed;
  }
  p.hp -= amount;
  G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted);
  if (p.hp <= 0) {
    p.hp = 0;
    G.missions.gameOver(G, 'K.O.');
  }
}

export function clearWanted(G) {
  G.wanted = 0;
  G.hiddenTimer = 0;
  G.heatTimer = 0;
}

// Respray shop: pay $100 per star to clear the wanted level.
export function tryRespray(G) {
  if (G.wanted === 0) { G.hud.setToast('Tidak ada bintang wanted'); return false; }
  const cost = G.wanted * CFG.resprayPerStar;
  if (G.player.cash < cost) { G.hud.setToast(`Respray butuh $${cost}`); return false; }
  G.player.cash -= cost;
  clearWanted(G);
  G.audio?.missionJingle();
  G.hud.setToast('Respray selesai — wanted hilang!');
  return true;
}
