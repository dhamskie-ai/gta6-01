// Wanted system + PCPD: patrol cars with flashing light bars and
// callsigns, foot cops, and the helicopter at wanted 3+.
import * as THREE from 'three';
import { CFG, CALLSIGNS } from './config.js';
import { rr, ri, pick, clamp, dist2, angDiff } from './random.js';
import { createCar, isCarObj, updateCarPhysics } from './vehicles.js';
import { collide } from './city.js';

export function addWanted(G, n) {
  G.wanted = clamp((G.wanted || 0) + n, 0, CFG.wantedMax);
  G.heat = 0;
  if (G.wanted > 0) G.lastSeenT = G.t;
}
export function setWanted(G, n) {
  G.wanted = clamp(n, 0, CFG.wantedMax);
  G.heat = 0;
}
function copMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), navy);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05),
    new THREE.MeshLambertMaterial({ color: 0xffd23a }));
  badge.position.set(0.15, 1.2, 0.19); g.add(badge);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.65; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 8), navy);
  cap.position.y = 1.86; g.add(cap);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), navy);
  legs.position.y = 0.35; g.add(legs);
  return g;
}
function buildHeli(G) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 1.8), bodyMat);
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.4, 1.85),
    new THREE.MeshLambertMaterial({ color: 0xffffff }));
  stripe.position.y = 0.2; g.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x9ad8ff }));
  glass.position.set(1.4, 0.2, 0); g.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), bodyMat);
  boom.position.set(-3, 0.3, 0); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.9), bodyMat);
  fin.position.set(-4.6, 0.8, 0); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1; g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  tailRotor.position.set(-4.6, 0.6, 0.4); g.add(tailRotor);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.15), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  skidL.position.set(0, -1, 0.7); g.add(skidL);
  const skidR = skidL.clone(); skidR.position.z = -0.7; g.add(skidR);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beacon.position.set(0, 1, 0); g.add(beacon);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.09,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI; cone.position.y = -12; g.add(cone);
  g.visible = false;
  G.fx.scene.add(g);
  return { g, rotor, tailRotor, beacon, cone, angle: 0 };
}
export function spawnPoliceCar(G, nearX, nearZ) {
  const seq = G._policeSeq = (G._policeSeq || 0) + 1;
  const callsign = CALLSIGNS[(seq - 1) % CALLSIGNS.length];
  const a = G.rng() * Math.PI * 2;
  const x = (nearX ?? G.player.x) + Math.cos(a) * rr(G.rng, 25, 45);
  const z = (nearZ ?? G.player.z) + Math.sin(a) * rr(G.rng, 25, 45);
  const car = createCar(G, 'police', x, z, 0, 'police');
  car.callsign = callsign;
  // light bar: red left half, blue right half, flashing in alternation
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2244ff });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.45), redMat);
  red.position.set(-0.4, 2.05, 0);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.45), blueMat);
  blue.position.set(0.4, 2.05, 0);
  car.mesh.add(red); car.mesh.add(blue);
  const unit = { car, callsign, role: 'PURSUIT', red, blue, redMat, blueMat, flashT: 0 };
  G.cops.push(unit);
  return unit;
}
function spawnFootCop(G) {
  const mesh = copMesh();
  const a = G.rng() * Math.PI * 2;
  const x = G.player.x + Math.cos(a) * 20, z = G.player.z + Math.sin(a) * 20;
  mesh.position.set(x, 0, z);
  G.fx.scene.add(mesh);
  const seq = G._policeSeq = (G._policeSeq || 0) + 1;
  const unit = { foot: true, mesh, x, z, heading: 0, speed: 0,
    callsign: CALLSIGNS[(seq - 1) % CALLSIGNS.length], role: 'PATROL' };
  G.cops.push(unit);
  return unit;
}
export function stagePolice(G, units) {
  // Shot staging: place units in a chase formation around the player car.
  const car = G.player.car;
  if (!isCarObj(car)) return;
  const spots = [
    { dx: -6, dz: -8 }, { dx: 6, dz: -8 }, { dx: -7, dz: 6 }, { dx: 7, dz: 6 },
    { dx: 0, dz: -14 }, { dx: -10, dz: -2 }, { dx: 10, dz: -2 },
  ];
  units.forEach((u, i) => {
    const s = spots[i % spots.length];
    const c = u.car || u;
    if (isCarObj(c)) {
      c.x = car.x + s.dx; c.z = car.z + s.dz; c.heading = car.heading; c.speed = 30;
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading;
    } else if (u.foot) {
      u.x = car.x + s.dx; u.z = car.z + s.dz;
      u.mesh.position.set(u.x, 0, u.z);
    }
  });
}
export function policeUnits(G) {
  const out = [];
  for (const u of G.cops) {
    const x = u.car ? u.car.x : u.x, z = u.car ? u.car.z : u.z;
    const d = Math.round(Math.sqrt(dist2(x, z, G.player.x, G.player.z)));
    out.push({ callsign: u.callsign, role: u.role, dist: d });
  }
  return out;
}
export function updatePolice(G, dt) {
  if (G.phase !== 'play' && !G.shotMode) return;
  const wanted = G.wanted || 0;
  // desired unit counts by wanted level
  const wantCars = wanted >= 2 ? Math.min(5, wanted) : 0;
  const wantFoot = wanted >= 1 ? Math.min(2, wanted) : 0;
  const cars = G.cops.filter((u) => !u.foot);
  const feet = G.cops.filter((u) => u.foot);
  if (!G.shotMode) {
    while (cars.length < wantCars) { spawnPoliceCar(G); cars.push(G.cops[G.cops.length - 1]); }
    while (feet.length < wantFoot) { spawnFootCop(G); feet.push(G.cops[G.cops.length - 1]); }
    // remove extras when wanted drops
    while (cars.length > wantCars) { const u = cars.pop(); G.fx.scene.remove(u.car.mesh); G.cars.splice(G.cars.indexOf(u.car), 1); G.cops.splice(G.cops.indexOf(u), 1); }
    while (feet.length > wantFoot) { const u = feet.pop(); G.fx.scene.remove(u.mesh); G.cops.splice(G.cops.indexOf(u), 1); }
  }
  const p = G.player;
  const pCar = isCarObj(p.car) ? p.car : null;
  const tx = p.x, tz = p.z;
  // police cars: chase + ram
  for (const u of G.cops) {
    if (u.foot) continue;
    const car = u.car;
    if (!isCarObj(car)) continue;
    const d = Math.sqrt(dist2(car.x, car.z, tx, tz));
    u.role = d < 25 ? 'RAMMING' : 'PURSUIT';
    if (wanted >= 4 && d > 40) u.role = 'ROADBLOCK';
    const desired = Math.atan2(tx - car.x, tz - car.z);
    const steer = clamp(angDiff(car.heading, desired) * 1.4, -1, 1);
    const throttle = d > 6 ? 1 : 0.4;
    updateCarPhysics(G, car, { throttle, steer, brake: false, hand: false }, dt);
    // ram: boost when close (no damage/slowdown in shot mode)
    if (d < 8 && !G.shotMode) {
      car.speed = Math.min(car.max, car.speed + 6 * dt);
      if (pCar && dist2(car.x, car.z, pCar.x, pCar.z) < 12) {
        pCar.speed *= 0.995;
        if (d < 4) pCar.hp = Math.max(0, pCar.hp - 2 * dt);
      }
    }
    // light bar flash: alternate red/blue
    u.flashT += dt;
    const on = Math.sin(u.flashT * 10) > 0;
    u.redMat.color.setHex(on ? 0xff2222 : 0x551111);
    u.blueMat.color.setHex(on ? 0x111155 : 0x2244ff);
  }
  // foot cops: run at the player, punch up close
  for (const u of G.cops) {
    if (!u.foot) continue;
    const d = Math.sqrt(dist2(u.x, u.z, tx, tz));
    const desired = Math.atan2(tx - u.x, tz - u.z);
    u.heading += angDiff(u.heading, desired) * Math.min(1, dt * 6);
    const sp = d > 2 ? 5.5 : 0;
    const nx = u.x + Math.sin(u.heading) * sp * dt;
    const nz = u.z + Math.cos(u.heading) * sp * dt;
    const hit = collide(G, nx, nz, 0.5);
    u.x = hit.x; u.z = hit.z;
    u.mesh.position.set(u.x, Math.abs(Math.sin(G.t * 10)) * 0.05, u.z);
    u.mesh.rotation.y = u.heading;
    if (d < 1.6 && !G.shotMode) {
      p.health = Math.max(0, (p.health || 100) - 6 * dt);
      if (p.health <= 0) G.phase = 'dead';
    }
  }
  // heat: cool down when no cop can see the player
  if (wanted > 0 && !G.shotMode) {
    let nearest = 1e9;
    for (const u of G.cops) {
      const x = u.car ? u.car.x : u.x, z = u.car ? u.car.z : u.z;
      nearest = Math.min(nearest, Math.sqrt(dist2(x, z, tx, tz)));
    }
    if (nearest > 60) {
      G.heat += dt;
      if (G.heat > CFG.heatCool) { G.wanted = Math.max(0, wanted - 1); G.heat = 0; }
      if (G.heat > CFG.heatClear) { G.wanted = 0; G.heat = 0; }
    } else G.heat = 0;
  }
  // Spray & Shine: pay $100/star to clear wanted
  if (pCar && wanted > 0) {
    const d = Math.sqrt(dist2(pCar.x, pCar.z, CFG.sprayPos.x, CFG.sprayPos.z));
    if (d < 8 && G.cash >= CFG.sprayCost * wanted) {
      G.cash -= CFG.sprayCost * wanted;
      G.wanted = 0; G.heat = 0;
      G.hudMsg = 'Spray & Shine — clean!';
    }
  }
  // helicopter at wanted >= 3
  if (!G.heli) G.heli = buildHeli(G);
  const heli = G.heli;
  if (wanted >= 3) {
    heli.g.visible = true;
    heli.angle += dt * 0.25;
    const hx = tx + Math.cos(heli.angle) * 26, hz = tz + Math.sin(heli.angle) * 26;
    heli.g.position.set(hx, 14, hz);
    heli.g.rotation.y = -heli.angle;
    heli.rotor.rotation.y += dt * 30;
    heli.tailRotor.rotation.x += dt * 30;
    heli.beacon.material.color.setHex(Math.sin(G.t * 8) > 0 ? 0xff2222 : 0x551111);
  } else heli.g.visible = false;
}
