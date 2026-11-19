// Wanted stars + PCPD response: patrol cars, foot police, helicopter at
// 3+ stars, callsigns, flashing red/blue light bars. Heat cools when the
// player stays unseen; Spray & Shine clears stars for cash.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { R } from './random.js';
import { makeCar, isCarObj, updateCarPhysics } from './vehicles.js';
import { spawnPed } from './traffic.js';
import { driveCarRef } from './player.js';
import { sfx } from './audio.js';

const CALLSIGNS = ['PELICAN-11', 'GECKO-25', 'IBIS-43', 'TARPON-19', 'HERON-17', 'KESTREL-31', 'MARLIN-26', 'BARRACUDA-18'];
let seq = 0;

export function setWanted(n) {
  G.wanted = Math.max(0, Math.min(CFG.maxWanted, n));
  G.heat = 0; G.hiddenT = 0;
}

export function addWanted(n) { setWanted(G.wanted + n); }

function spawnPoliceCar(x, z) {
  const c = makeCar('police', x, z, 0);
  c.callsign = CALLSIGNS[seq++ % CALLSIGNS.length];
  c.role = 'PURSUIT';
  c.kind = 'car';
  G.police.push(c);
  return c;
}

function spawnFootCop(x, z) {
  const p = spawnPed(x, z, { color: 0x11151c, hat: 0x11151c });
  p.kind = 'foot'; p.callsign = CALLSIGNS[seq++ % CALLSIGNS.length];
  p.role = 'PATROL';
  G.police.push(p);
  return p;
}

export function policeUnits() {
  // HUD list: cars + foot cops, nearest first, with role + distance.
  const px = G.player.pos.x, pz = G.player.pos.z;
  return G.police
    .filter((u) => u && typeof u === 'object' && typeof u.x === 'number')
    .map((u) => ({ name: u.callsign || 'PCPD', role: u.role || 'PURSUIT', d: Math.round(Math.hypot(u.x - px, u.z - pz)) }))
    .sort((a, b) => a.d - b.d);
}

function ensureHeli() {
  if (G.heli) return G.heli;
  const g = new THREE.Group();
  const bodyM = new THREE.MeshLambertMaterial({ color: 0x1e2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 1.8), bodyM);
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0.8 }));
  glass.position.set(2.2, 0.2, 0); g.add(glass);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.3, 1.85),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  stripe.position.y = 0.4; g.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 0.5), bodyM);
  tail.position.set(-4, 0.4, 0); g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1; g.add(rotor);
  const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), rotor.material);
  tailR.position.set(-6, 0.5, 0); g.add(tailR);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  beacon.position.y = -1; g.add(beacon);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI; cone.position.y = -14; g.add(cone);
  g.visible = false;
  G.scene.add(g);
  G.heli = { group: g, rotor, beacon, ang: 0 };
  return G.heli;
}

export function updatePolice(dt) {
  const want = G.wanted;
  const targetN = want === 0 ? 0 : want === 1 ? 2 : want + 1;
  // spawn / despawn to match wanted level
  const cars = G.police.filter((u) => u && u.kind === 'car');
  const feet = G.police.filter((u) => u && u.kind === 'foot');
  if (want >= 1 && feet.length < Math.min(2, want)) {
    spawnFootCop(G.player.pos.x + R.range(-18, 18), G.player.pos.z + R.range(-18, 18));
  }
  if (cars.length < targetN) {
    const a = R.range(0, Math.PI * 2);
    spawnPoliceCar(G.player.pos.x + Math.sin(a) * 55, G.player.pos.z + Math.cos(a) * 55);
  }
  const px = G.player.pos.x, pz = G.player.pos.z;
  const pc = driveCarRef();
  const pspeed = pc ? Math.abs(pc.speed) : G.player.speed;
  for (const u of [...G.police]) {
    if (!u || typeof u !== 'object') continue;
    const d = Math.hypot(u.x - px, u.z - pz);
    u.role = d < 14 ? 'RAMMING' : (u.kind === 'foot' ? 'PATROL' : 'PURSUIT');
    if (u.kind === 'car') {
      if (!isCarObj(u)) continue;
      const want2 = Math.atan2(px - u.x, pz - u.z);
      let dh = want2 - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      updateCarPhysics(u, dt, { throttle: d > 6 ? 1 : 0.4, steer, brake: false, hand: false });
      // ram: bump the player car when close
      if (pc && d < 4.5 && !G.shotMode) {
        pc.speed *= 0.92; pc.hp -= 0.2;
        if (Math.random() < dt * 2) sfx.skid();
      }
      // flashing light bar: alternate red/blue
      const on = Math.floor(G.elapsed * 6) % 2 === 0;
      if (u.barL) u.barL.material.color.setHex(on ? 0xff2020 : 0x550000);
      if (u.barR) u.barR.material.color.setHex(on ? 0x000055 : 0x2050ff);
      if (d > 260) { G.scene.remove(u.group); G.police.splice(G.police.indexOf(u), 1); }
    } else {
      // foot cop: chase on foot, punch when adjacent
      const want2 = Math.atan2(px - u.x, pz - u.z);
      u.heading = want2;
      const sp = d > 2 ? 5.2 : 0;
      u.x += Math.sin(u.heading) * sp * dt;
      u.z += Math.cos(u.heading) * sp * dt;
      u.group.position.set(u.x, 0, u.z);
      u.group.rotation.y = u.heading;
      if (d < 1.6 && !G.shotMode) {
        G.health -= 14 * dt;
        if (Math.random() < dt * 1.5) sfx.punch();
      }
      if (d > 160) { G.scene.remove(u.group); G.peds.splice(G.peds.indexOf(u), 1); G.police.splice(G.police.indexOf(u), 1); }
    }
  }
  // helicopter at 3+ stars, orbiting the player
  const heli = ensureHeli();
  if (want >= 3 && G.phase === 'play') {
    heli.group.visible = true;
    heli.ang += dt * 0.25;
    heli.group.position.set(px + Math.cos(heli.ang) * 30, 26 + Math.sin(G.elapsed * 0.7) * 2, pz + Math.sin(heli.ang) * 30);
    heli.group.rotation.y = -heli.ang;
    heli.rotor.rotation.y += dt * 22;
    heli.beacon.material.color.setHex(Math.floor(G.elapsed * 3) % 2 ? 0xff2020 : 0x550000);
  } else heli.group.visible = false;
  // heat: cools when the player is far from every unit; hides fully after 20 s
  if (want > 0) {
    const nearest = G.police.reduce((m, u) => Math.min(m, (u && typeof u.x === 'number') ? Math.hypot(u.x - px, u.z - pz) : 999), 999);
    if (nearest > 45) {
      G.hiddenT += dt;
      if (G.hiddenT > CFG.hideCool) { setWanted(0); }
      else if (G.hiddenT > CFG.heatCool && pspeed < 2) setWanted(want - 1);
    } else G.hiddenT = 0;
  }
  // Spray & Shine: drive through to clear stars for cash
  if (want > 0) {
    const dx = px - CFG.spray.x, dz = pz - CFG.spray.z;
    if (dx * dx + dz * dz < 100 && G.cash >= CFG.respray * want) {
      G.cash -= CFG.respray * want;
      setWanted(0);
      sfx.coin();
    }
  }
}
