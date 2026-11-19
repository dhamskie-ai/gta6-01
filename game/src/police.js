import * as THREE from 'three';
import { CFG, POLICE_CALLSIGNS } from './config.js';
import { makeCar, driveToward } from './vehicles.js';
import { createPersonMesh } from './player.js';
import { rr, pick } from './random.js';

export function addWanted(G, n, reason) {
  if (G.shotMode && G._shotWantedLock) return;
  G.wanted = Math.max(0, Math.min(5, G.wanted + n));
  G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted);
  G.wantedSeen = 0;
  G.wantedTimer = 0;
  if (G.wanted > 0) G.audio.siren(true);
  if (reason && G.hud) G.hud.toast(reason);
}

export function policeUnits(G) {
  const units = [];
  for (const pc of G.policeCars) {
    const d = Math.round(Math.hypot(pc.car.x - G.player.x, pc.car.z - G.player.z));
    units.push({ callsign: pc.callsign, dist: d, role: pc.role });
  }
  if (G._heliVisible) {
    const d = Math.round(Math.hypot(G._heli.position.x - G.player.x, G._heli.position.z - G.player.z));
    units.push({ callsign: 'AIR-1', dist: d, role: 'SPOTLIGHT' });
  }
  return units;
}

function spawnPoliceCar(G) {
  const a = Math.random() * Math.PI * 2;
  const x = G.player.x + Math.cos(a) * 55;
  const z = G.player.z + Math.sin(a) * 55;
  const car = makeCar('police', x, z, 0);
  car.speed = 10;
  G.W.scene.add(car.group);
  const barMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.5), barMat);
  bar.position.set(-0.1, 1.62, 0);
  car.group.add(bar);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2040ff });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.7), redMat);
  red.position.set(-0.1, 1.64, -0.38); car.group.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.7), blueMat);
  blue.position.set(-0.1, 1.64, 0.38); car.group.add(blue);
  const callsign = POLICE_CALLSIGNS[G._policeSeq % POLICE_CALLSIGNS.length];
  G._policeSeq++;
  G.policeCars.push({ car, callsign, role: 'PURSUIT', redMat, blueMat, flash: 0 });
}

function spawnFootPolice(G) {
  const a = Math.random() * Math.PI * 2;
  const x = G.player.x + Math.cos(a) * 22;
  const z = G.player.z + Math.sin(a) * 22;
  const mesh = createPersonMesh({ shirt: 0x1c2f4a, pants: 0x14181f, skin: 0xc98d64, hair: 0x14100c });
  mesh.position.set(x, 0, z);
  G.W.scene.add(mesh);
  G.footPolice.push({ mesh, x, z, hp: 60, attackCd: 0, walkPhase: Math.random() * 6 });
}

function buildHelicopter(G) {
  const heli = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 1.8), bodyMat);
  heli.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 1.85),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  stripe.position.y = 0.2; heli.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
  glass.position.set(2.2, 0.2, 0); heli.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.5), bodyMat);
  boom.position.set(-3.6, 0.4, 0); heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.9), bodyMat);
  fin.position.set(-5.2, 0.9, 0); heli.add(fin);
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 9.5), rotorMat);
  rotor.position.y = 1.15; heli.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.3), rotorMat);
  tailRotor.position.set(-5.2, 0.9, 0.5); heli.add(tailRotor);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), beaconMat);
  beacon.position.set(0, -0.95, 0); heli.add(beacon);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 12, 1, true), coneMat);
  cone.rotation.x = Math.PI;
  cone.position.y = -13.5;
  heli.add(cone);
  heli.userData = { rotor, tailRotor, beaconMat, coneMat };
  heli.visible = false;
  G.W.scene.add(heli);
  return heli;
}

export function updatePolice(G, dt, elapsed) {
  if (!G._heli) G._heli = buildHelicopter(G);
  const px = G.player.x, pz = G.player.z;
  const seen = G.policeCars.length > 0 || G.footPolice.length > 0;
  if (G.wanted > 0) {
    if (seen) { G.wantedSeen = 0; G.wantedTimer = 0; }
    else {
      G.wantedTimer += dt;
      if (G.wantedTimer > CFG.wantedDecayUnseen) {
        G.wanted = Math.max(0, G.wanted - 1);
        G.wantedTimer = 0;
        if (G.wanted === 0) G.audio.siren(false);
      }
    }
    const wantCars = Math.min(4, Math.max(0, G.wanted - 1));
    while (G.policeCars.length < wantCars) spawnPoliceCar(G);
    while (G.policeCars.length > wantCars) {
      const pc = G.policeCars.pop();
      G.W.scene.remove(pc.car.group);
    }
    const wantFoot = G.wanted >= 1 ? Math.min(2, G.wanted) : 0;
    while (G.footPolice.length < wantFoot) spawnFootPolice(G);
    while (G.footPolice.length > wantFoot) {
      const fp = G.footPolice.pop();
      G.W.scene.remove(fp.mesh);
    }
  } else {
    while (G.policeCars.length) { const pc = G.policeCars.pop(); G.W.scene.remove(pc.car.group); }
    while (G.footPolice.length) { const fp = G.footPolice.pop(); G.W.scene.remove(fp.mesh); }
    G.audio.siren(false);
  }
  for (const pc of G.policeCars) {
    const d = Math.hypot(pc.car.x - px, pc.car.z - pz);
    pc.role = d < 14 ? 'RAMMING' : d < 60 ? 'PURSUIT' : 'ROADBLOCK';
    driveToward(pc.car, px, pz, dt, G.city, pc.role === 'RAMMING' ? 42 : 36);
    pc.flash += dt * 7;
    const on = Math.sin(pc.flash) > 0;
    pc.redMat.color.setHex(on ? 0xff2020 : 0x4a1414);
    pc.blueMat.color.setHex(on ? 0x141a4a : 0x2040ff);
    if (G.car && d < 3.4) {
      G.car.hp = Math.max(0, G.car.hp - 6 * dt);
      G.car.speed *= 0.96;
    }
  }
  for (const fp of G.footPolice) {
    const dx = px - fp.x, dz = pz - fp.z;
    const d = Math.hypot(dx, dz) || 1;
    const spd = d < 30 ? 5.4 : 3.4;
    fp.x += (dx / d) * spd * dt;
    fp.z += (dz / d) * spd * dt;
    fp.walkPhase += dt * spd * 3;
    fp.mesh.position.set(fp.x, 0, fp.z);
    fp.mesh.rotation.y = Math.atan2(dx, dz);
    const swing = Math.sin(fp.walkPhase) * 0.55;
    fp.mesh.userData.legL.rotation.x = swing;
    fp.mesh.userData.legR.rotation.x = -swing;
    fp.attackCd -= dt;
    if (d < 1.6 && !G.inCar && fp.attackCd <= 0) {
      fp.attackCd = 1.1;
      G.health -= 8;
      G.audio.punch();
      if (G.health <= 0) { G.health = 0; G.phase = 'busted'; G.audio.busted(); }
    }
    if (d < 1.6 && G.inCar) { /* officer pounds the car, no grab while driving */ }
  }
  const wantHeli = G.wanted >= 3;
  G._heliVisible = wantHeli;
  G._heli.visible = wantHeli;
  if (wantHeli) {
    const a = elapsed * 0.16;
    const fx = Math.sin(G.player.heading), fz = Math.cos(G.player.heading);
    G._heli.position.set(
      px + fx * 12 + Math.cos(a) * 10, 12,
      pz + fz * 12 + Math.sin(a) * 10);
    G._heli.rotation.y = Math.atan2(px - G._heli.position.x, pz - G._heli.position.z);
    G._heli.userData.rotor.rotation.y += dt * 22;
    G._heli.userData.tailRotor.rotation.x += dt * 30;
    G._heli.userData.beaconMat.color.setHex(Math.sin(elapsed * 6) > 0 ? 0xff2020 : 0x4a1414);
  }
  if (G.wanted > 0) {
    const d = Math.hypot(px - CFG.sprayShop.x, pz - CFG.sprayShop.z);
    if (d < 10) {
      G._nearRespray = true;
      if (G._resprayKey) {
        const cost = G.wanted * CFG.resprayPerStar;
        if (G.cash >= cost) {
          G.cash -= cost;
          G.wanted = 0;
          G.audio.jingle(true);
          if (G.hud) G.hud.toast(`Respray selesai — bintang hilang ($${cost})`);
        }
      }
    } else G._nearRespray = false;
  }
  G.audio.updateSiren(dt);
}
