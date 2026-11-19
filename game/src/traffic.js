// Traffic AI on the road graph + pedestrians on the sidewalks.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, range, pick, chance, clamp } from './random.js';
import { makeCarModel } from './vehicles.js';

const NODES = [-240, -120, 0, 120, 240];
const PED_COLORS = [0xd23a3a, 0x3a7ad2, 0x3ad26a, 0xd2a03a, 0x8a5ad2, 0xe8e8e8, 0x222222, 0xff9ad8];

function pedFigure(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), mat); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: 0xd8a077 })); head.position.y = 1.68; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), new THREE.MeshLambertMaterial({ color: 0x2a2a33 })); legL.position.set(-0.14, 0.3, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), mat); armL.position.set(-0.38, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.38; g.add(armR);
  return { group: g, legL, legR, armL, armR };
}

export function createTraffic(G) {
  const r = mulberry32(G.seed + 9);
  const cars = [], peds = [];
  const nodes = [];
  for (const x of NODES) for (const z of NODES) nodes.push({ x, z });
  nodes.push({ x: -264, z: -240 }, { x: -264, z: -120 }, { x: -264, z: 0 }, { x: -264, z: 120 }, { x: -264, z: 240 });
  function neighbors(n) {
    return nodes.filter((m) => m !== n && ((m.x === n.x && Math.abs(m.z - n.z) === 120) || (m.z === n.z && Math.abs(m.x - n.x) === 120) || (n.x === -264 && m.x === -264 && Math.abs(m.z - n.z) === 120)));
  }
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const type = pick(r, ['sedan', 'hatch', 'taxi', 'van', 'sedan', 'hatch']);
    const c = CONFIG.cars[type];
    const m = makeCarModel(type, c.color);
    const from = pick(r, nodes);
    const to = pick(r, neighbors(from));
    G.scene.add(m.group);
    cars.push({ type, group: m.group, wheels: m.wheels, from, to, t: r(), speed: range(r, 8, 13), x: from.x, z: from.z, heading: 0, honkT: 0 });
  }
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const f = pedFigure(pick(r, PED_COLORS));
    const x = range(r, -240, 240), z = pick(r, NODES) + (chance(r, 0.5) ? 10 : -10) + range(r, -30, 30);
    f.group.position.set(x, 0, z);
    G.scene.add(f.group);
    peds.push({ ...f, x, z, heading: range(r, 0, Math.PI * 2), speed: range(r, 1, 2), idle: range(r, 0, 4), jog: false, flee: 0, walkPhase: r() * 6 });
  }
  let bonus = null, bonusT = 0;
  const bonusMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 12), new THREE.MeshBasicMaterial({ color: 0x5dff8f }));
  bonusMesh.rotation.x = Math.PI / 2; G.scene.add(bonusMesh);
  function placeBonus() {
    bonus = { x: pick(r, NODES) + range(r, -80, 80), z: pick(r, NODES) + range(r, -80, 80) };
    bonusMesh.position.set(bonus.x, 1.1, bonus.z); bonusT = 40;
  }
  placeBonus();
  return {
    cars, peds,
    bonus: () => bonus,
    update(dt, t) {
      const px = G.player.x, pz = G.player.z;
      for (const c of cars) {
        c.t += (c.speed * dt) / 120;
        if (c.t >= 1) { c.from = c.to; c.to = pick(r, neighbors(c.to)); c.t = 0; }
        const nx = c.from.x + (c.to.x - c.from.x) * c.t;
        const nz = c.from.z + (c.to.z - c.from.z) * c.t;
        // stop at red lights near intersections
        const nearIx = Math.abs(nx) < 26 || Math.abs(nz) < 26;
        const red = G.city.lightState(nx, nz) === 'red' && (Math.abs(nx % 120) < 22 || Math.abs(nz % 120) < 22);
        let target = c.speed;
        if (red && nearIx) target = 0;
        const ahead = Math.hypot(px - nx, pz - nz);
        if (G.car && ahead < 9) target = 0; // player blocks the road
        if (target === 0 && c.speed > 0.5 && c.honkT <= 0) { G.audio.horn(); c.honkT = 4; }
        c.honkT -= dt;
        c.speed += clamp(target - c.speed, -14 * dt, 6 * dt);
        c.x = nx; c.z = nz;
        c.heading = Math.atan2(c.to.x - c.from.x, c.to.z - c.from.z);
        c.group.position.set(nx, 0, nz); c.group.rotation.y = c.heading;
        for (const w of c.wheels) w.rotation.x += c.speed * dt * 2;
      }
      for (const p of peds) {
        if (p.idle > 0) { p.idle -= dt; }
        else {
          const fleeing = p.flee > 0 || (G.combat?.lastShotT && t - G.combat.lastShotT < 2);
          const sp = fleeing ? 5 : p.jog ? 3.4 : p.speed;
          p.x += Math.sin(p.heading) * sp * dt;
          p.z += Math.cos(p.heading) * sp * dt;
          p.walkPhase += dt * sp * 3;
          if (chance(r, 0.002)) { p.idle = range(r, 2, 5); }
          if (chance(r, 0.001)) { p.heading += range(r, -1.5, 1.5); p.jog = chance(r, 0.3); }
          if (Math.abs(p.x) > 250 || Math.abs(p.z) > 250) p.heading += Math.PI;
          if (G.car && Math.hypot(p.x - G.car.x, p.z - G.car.z) < 5) { p.flee = 2; p.heading = Math.atan2(p.x - G.car.x, p.z - G.car.z); }
        }
        p.flee = Math.max(0, p.flee - dt);
        p.group.position.set(p.x, 0, p.z);
        p.group.rotation.y = p.heading;
        const sw = Math.sin(p.walkPhase) * 0.5;
        p.legL.rotation.x = sw; p.legR.rotation.x = -sw; p.armL.rotation.x = -sw; p.armR.rotation.x = sw;
      }
      bonusT -= dt;
      bonusMesh.rotation.z += dt * 2;
      if (bonusT <= 0) placeBonus();
      const pd = Math.hypot(px - bonus.x, pz - bonus.z);
      if (pd < 2.2) { G.cash += 25; G.audio.coin(); G.hud.ticker('Street bonus +$25'); placeBonus(); }
    },
  };
}
