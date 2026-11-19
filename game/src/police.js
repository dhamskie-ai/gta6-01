// Wanted system PCPD + AI polisi (mobil, jalan kaki, helikopter, roadblock).
import { CALLSIGNS, CONFIG } from './config.js';
import { clamp, dist2 } from './random.js';
import { spawnCar, damagePlayer, explodeCar } from './vehicles.js';

export function addWanted(G, n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.stats.maxWanted = Math.max(G.stats.maxWanted || 0, G.wanted);
  G.heat = 1; G.wantedTimer = 0;
  if (G.wanted > 0) G.audio.siren(true);
}

export function updateWanted(G, dt) {
  if (G.wanted <= 0) return;
  let nearest = 1e9;
  for (const c of G.policeCars) nearest = Math.min(nearest, dist2(c.x, c.z, G.player.x, G.player.z));
  const seen = nearest < 45 * 45;
  if (!seen) {
    G.wantedTimer += dt;
    if (G.wantedTimer > CONFIG.wantedDecay) {
      G.wanted--; G.wantedTimer = 0; G.heat = Math.max(0, G.heat - 0.5);
      if (G.wanted === 0) G.audio.siren(false);
    }
  } else G.wantedTimer = 0;
}

function nextCallsign(G) {
  const cs = CALLSIGNS[G._policeSeq % CALLSIGNS.length];
  G._policeSeq = (G._policeSeq || 0) + 1;
  return cs;
}

export function targetPoliceCount(wanted) {
  if (wanted <= 0) return 0;
  return wanted; // 1..5 mobil kejar
}

export function maintainPolice(G, THREE, city, rng) {
  if (G.shotMode) return; // staging shot mengatur unit sendiri
  const want = targetPoliceCount(G.wanted);
  // tambah mobil kejar
  while (G.policeCars.length < want) {
    const a = rng() * Math.PI * 2;
    const d = 70 + rng() * 30;
    let x = G.player.x + Math.sin(a) * d, z = G.player.z + Math.cos(a) * d;
    x = clamp(x, -280, 280); z = clamp(z, -280, 280);
    const car = spawnCar(G, THREE, city, 'police', x, z, 0, { ai: { police: true } });
    car.callsign = nextCallsign(G);
    car.role = 'PURSUIT';
    G.policeCars.push(car);
  }
  // kurangi bila wanted turun
  while (G.policeCars.length > want) {
    const car = G.policeCars.pop();
    car.mesh.visible = false; car.dead = true;
    G.cars.splice(G.cars.indexOf(car), 1);
  }
  // polisi jalan kaki di wanted 1
  while (G.footCops.length < (G.wanted === 1 ? 2 : 0)) {
    const a = rng() * Math.PI * 2;
    const cop = {
      x: G.player.x + Math.sin(a) * 18, z: G.player.z + Math.cos(a) * 18,
      yaw: 0, speed: 3.4, hp: 40, callsign: nextCallsign(G), role: 'FOOT',
      mesh: null, punchCd: 0,
    };
    cop.mesh = makeCopMesh(THREE);
    cop.mesh.position.set(cop.x, 0, cop.z);
    G.scene.add(cop.mesh);
    G.footCops.push(cop);
  }
  while (G.footCops.length > (G.wanted === 1 ? 2 : 0)) {
    const cop = G.footCops.pop();
    G.scene.remove(cop.mesh);
  }
  // helikopter di wanted >= 3
  if (G.wanted >= 3 && !G.heli) buildHeli(G, THREE);
  if (G.wanted < 3 && G.heli) { G.scene.remove(G.heli.mesh); G.heli = null; }
  // roadblock di wanted >= 4
  if (G.wanted >= 4 && !G.roadblock) buildRoadblock(G, THREE, city);
  if (G.wanted < 4 && G.roadblock) {
    for (const c of G.roadblock.cars) { c.mesh.visible = false; c.dead = true; G.cars.splice(G.cars.indexOf(c), 1); }
    G.policeCars = G.policeCars.filter((c) => !G.roadblock.cars.includes(c));
    G.roadblock = null;
  }
}

function makeCopMesh(THREE) {
  const g = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({ color: 0x1c2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.0, 0.38), uni);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.8; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8),
    new THREE.MeshLambertMaterial({ color: 0x10151f }));
  cap.position.y = 2.02; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), uni);
  legL.position.set(-0.17, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  g.userData = { legL, legR };
  return g;
}

function buildHeli(G, THREE) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 2.0),
    new THREE.MeshLambertMaterial({ color: 0x1c2a4a }));
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 2.05),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  stripe.position.y = 0.2; g.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.8),
    new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
  glass.position.set(2.2, 0.1, 0); g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1c2a4a }));
  tail.position.set(-4.2, 0.4, 0); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x1c2a4a }));
  fin.position.set(-6.2, 1.0, 0); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x14181f }));
  rotor.position.y = 1.1; g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x14181f }));
  tailRotor.position.set(-6.2, 0.6, 0.5); g.add(tailRotor);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2a22 }));
  beacon.position.set(0, -0.9, 0); g.add(beacon);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI; cone.position.y = -7.5; g.add(cone);
  G.scene.add(g);
  G.heli = { mesh: g, rotor, tailRotor, beacon, angle: 0, callsign: 'AIR-1', role: 'SPOTLIGHT' };
}

function buildRoadblock(G, THREE, city) {
  const px = G.player.inCar ? G.playerCar.x : G.player.x;
  const pz = G.player.inCar ? G.playerCar.z : G.player.z;
  const yaw = G.player.inCar ? G.playerCar.yaw : G.player.yaw;
  const ahead = 42;
  const cx = px + Math.sin(yaw) * ahead, cz = pz + Math.cos(yaw) * ahead;
  const cars = [];
  for (const s of [-1, 1]) {
    const ox = cx + Math.cos(yaw) * s * 3.4, oz = cz - Math.sin(yaw) * s * 3.4;
    const car = spawnCar(G, THREE, city, 'police', ox, oz, yaw + Math.PI / 2, { ai: { roadblock: true } });
    car.callsign = nextCallsign(G);
    car.role = 'ROADBLOCK';
    cars.push(car);
    G.policeCars.push(car);
  }
  G.roadblock = { cars, x: cx, z: cz };
}

// Staging shot: posisikan unit relatif terhadap mobil (formasi kejar),
// JANGAN di atas mobil. offsets = [lateral, longitudinal] lokal mobil.
export function stagePolice(G, THREE, city, offsets) {
  const car = G.playerCar;
  const yaw = car.yaw;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  let i = 0;
  for (const [lat, lon] of offsets) {
    let unit = G.policeCars[i];
    if (!unit) {
      unit = spawnCar(G, THREE, city, 'police', 0, 0, 0, { ai: { police: true } });
      unit.callsign = nextCallsign(G);
      G.policeCars.push(unit);
    }
    const x = car.x + cos * lat + sin * lon;
    const z = car.z - sin * lat + cos * lon;
    unit.x = x; unit.z = z; unit.yaw = yaw;
    unit.speed = Math.abs(car.speed) * 0.9;
    unit.role = Math.abs(lon) < 14 ? 'RAMMING' : 'PURSUIT';
    unit.mesh.position.set(x, 0, z);
    unit.mesh.rotation.y = yaw;
    i++;
  }
  if (G.wanted >= 3 && !G.heli) buildHeli(G, THREE);
  if (G.heli) {
    G.heli.angle = 0; // tepat di depan mobil, di atas jalan — terlihat di frame
    G.heli.mesh.position.set(car.x + Math.sin(0) * 26, 14, car.z + Math.cos(0) * 26);
    G.heli.mesh.visible = true;
  }
}

export function updatePolice(G, dt, city) {
  const px = G.player.inCar ? G.playerCar.x : G.player.x;
  const pz = G.player.inCar ? G.playerCar.z : G.player.z;
  const inCar = G.player.inCar;
  G.policeUnits = [];
  for (const car of G.policeCars) {
    if (car.dead) continue;
    const ai = car.ai || {};
    if (ai.roadblock) {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.yaw;
      const d = Math.sqrt(dist2(car.x, car.z, px, pz));
      G.policeUnits.push({ callsign: car.callsign, dist: Math.round(d), role: 'ROADBLOCK' });
      continue;
    }
    const dx = px - car.x, dz = pz - car.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += clamp(dy, -1.6 * dt, 1.6 * dt);
    const targetSpeed = inCar ? Math.min(34, Math.abs(G.playerCar.speed) + 2.5) : 12;
    car.speed += clamp(targetSpeed - car.speed, -18 * dt, 10 * dt);
    const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    if (!city.collide(nx, nz, 1.6)) { car.x = nx; car.z = nz; }
    else { car.yaw += 1.2 * dt; car.speed *= 0.6; }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
    // lampu bar merah/biru berkedip bergantian
    const ph = Math.floor(performance.now() / 260) % 2 === 0;
    if (car.mesh.userData.barL) {
      car.mesh.userData.barL.material.color.setHex(ph ? 0xff2a22 : 0x550000);
      car.mesh.userData.barR.material.color.setHex(ph ? 0x002255 : 0x2a6bff);
    }
    // tabrak pemain
    if (d < 4.2) {
      car.role = 'RAMMING';
      if (inCar && !G.shotMode) {
        G.playerCar.speed *= 0.94;
        G.playerCar.hp -= 6 * dt;
        if (G.playerCar.hp <= 0) explodeCar(G, G.playerCar);
      }
      // shot mode: tanpa perlambatan / damage dari ram polisi
    } else if (d < 30 && G.wanted >= 4) car.role = 'FIRING';
    else car.role = 'PURSUIT';
    G.policeUnits.push({ callsign: car.callsign, dist: Math.round(d), role: car.role });
  }
  // polisi jalan kaki
  for (const cop of G.footCops) {
    const dx = px - cop.x, dz = pz - cop.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    cop.yaw = Math.atan2(dx, dz);
    if (d > 1.6) { cop.x += Math.sin(cop.yaw) * cop.speed * dt; cop.z += Math.cos(cop.yaw) * cop.speed * dt; }
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.yaw;
    cop.punchCd -= dt;
    if (d < 1.8 && cop.punchCd <= 0 && !inCar) {
      cop.punchCd = 1.1;
      G.audio.punch();
      if (!G.shotMode) damagePlayer(G, 8);
    }
  }
  // helikopter: orbit radius 26, tinggi 14
  if (G.heli) {
    const h = G.heli;
    h.angle += dt * 0.22;
    h.mesh.position.set(px + Math.sin(h.angle) * 26, 14, pz + Math.cos(h.angle) * 26);
    h.mesh.rotation.y = -h.angle + Math.PI / 2;
    h.rotor.rotation.y += dt * 22;
    h.tailRotor.rotation.x += dt * 30;
    h.beacon.material.color.setHex(Math.floor(performance.now() / 400) % 2 ? 0xff2a22 : 0x550000);
    G.policeUnits.push({ callsign: 'AIR-1', dist: 26, role: 'SPOTLIGHT' });
  }
  G.policeUnits.sort((a, b) => a.dist - b.dist);
}
