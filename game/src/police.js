// PCPD wanted system: foot cops, patrol cars, roadblocks, helicopter.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, range, pick, clamp } from './random.js';
import { makeCarModel } from './vehicles.js';

export function createPolice(G) {
  const r = mulberry32(G.seed + 13);
  const cars = [], cops = [];
  let heli = null, heliAngle = -Math.PI / 2, seq = 0, unseenT = 0, bustedT = 0; // heli starts ahead of the player
  const units = []; // HUD response list: spawned + en-route
  const copMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const copSkin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  function makeCop() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.34), copMat); body.position.y = 1.1; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), copSkin); head.position.y = 1.72; g.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x111111 })); hat.position.y = 1.94; g.add(hat);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), copMat); legL.position.set(-0.15, 0.33, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
    G.scene.add(g);
    return { group: g, legL, legR, x: 0, z: 0, heading: 0, phase: 0, name: pick(r, CONFIG.policeNames) };
  }
  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 4.2), new THREE.MeshLambertMaterial({ color: 0x4a6a8a }));
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 4.3), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    stripe.position.y = 0.2; g.add(stripe);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1.2), new THREE.MeshLambertMaterial({ color: 0x9ad8ff }));
    glass.position.set(0, 0.3, 1.8); g.add(glass);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), body.material); boom.position.set(0, 0.2, -4); g.add(boom);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1; g.add(rotor);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.5), rotor.material); tail.position.set(0, 0.4, -6); g.add(tail);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    beacon.position.y = -0.9; g.add(beacon);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    cone.rotation.x = Math.PI; cone.position.y = -12; g.add(cone);
    g.visible = false; G.scene.add(g);
    return { group: g, rotor, beacon, cone };
  }
  function spawnCar() {
    const a = range(r, 0, Math.PI * 2);
    const x = G.player.x + Math.sin(a) * 55, z = G.player.z + Math.cos(a) * 55;
    const m = makeCarModel('police', CONFIG.cars.police.color);
    m.group.position.set(x, 0, z);
    // split red/blue light bar
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    barR.position.set(-0.4, 1.95, -0.2); m.group.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2f7bff }));
    barB.position.set(0.4, 1.95, -0.2); m.group.add(barB);
    G.scene.add(m.group);
    const car = { type: 'police', group: m.group, wheels: m.wheels, x, z, heading: a, speed: 0, hp: 100, name: CONFIG.policeNames[seq++ % CONFIG.policeNames.length], barR, barB, roadblock: false };
    cars.push(car); return car;
  }
  function addWanted(n) {
    G.wanted = clamp(G.wanted + n, 0, 5);
    unseenT = 0;
    if (G.wanted > 0) G.hud.showStars();
  }
  function nearestPoliceDist() {
    let d = 1e9;
    for (const c of cars) d = Math.min(d, Math.hypot(c.x - G.player.x, c.z - G.player.z));
    for (const c of cops) d = Math.min(d, Math.hypot(c.x - G.player.x, c.z - G.player.z));
    if (heli && heli.group.visible) d = Math.min(d, 30);
    return d;
  }
  return {
    cars, cops, units,
    addWanted,
    clearWanted() { G.wanted = 0; unseenT = 0; },
    seen() { return nearestPoliceDist() < 45; },
    update(dt, t) {
      const want = G.wanted;
      const wantCars = want >= 2 ? Math.min(4, want) : 0;
      const wantCops = want >= 1 ? Math.min(2, want) : 0;
      while (cars.length < wantCars) spawnCar();
      while (cops.length < wantCops) { const c = makeCop(); c.x = G.player.x + range(r, -40, 40); c.z = G.player.z + range(r, -40, 40); cops.push(c); }
      if (want === 0) {
        for (const c of [...cars]) { G.scene.remove(c.group); cars.splice(cars.indexOf(c), 1); }
        for (const c of [...cops]) { G.scene.remove(c.group); cops.splice(cops.indexOf(c), 1); }
        if (heli) heli.group.visible = false;
      }
      // heat decay
      if (want > 0) {
        if (nearestPoliceDist() > 45) { unseenT += dt; if (unseenT > CONFIG.wantedDecaySeen) { G.wanted--; unseenT = 0; } }
        else unseenT = 0;
        if (unseenT > CONFIG.wantedDecayHidden) { G.wanted = 0; unseenT = 0; }
      }
      // helicopter at wanted >= 3
      if (want >= 3) {
        if (!heli) heli = makeHeli();
        heli.group.visible = true;
        heliAngle += dt * 0.25;
        const hx = G.player.x + Math.cos(heliAngle) * 26, hz = G.player.z + Math.sin(heliAngle) * 26;
        heli.group.position.set(hx, 14, hz);
        heli.group.rotation.y = -heliAngle;
        heli.rotor.rotation.y += dt * 22;
        heli.beacon.material.color.setHex(Math.floor(t * 3) % 2 ? 0xff3b30 : 0x441111);
      } else if (heli) heli.group.visible = false;
      // patrol cars chase + ram, one roadblocks at wanted >= 4
      const px = G.car ? G.car.x : G.player.x, pz = G.car ? G.car.z : G.player.z;
      cars.forEach((c, i) => {
        c.roadblock = want >= 4 && i === 0;
        const tx = c.roadblock ? px + Math.sin(G.player.heading) * 26 : px;
        const tz = c.roadblock ? pz + Math.cos(G.player.heading) * 26 : pz;
        const d = Math.hypot(tx - c.x, tz - c.z);
        const wantH = Math.atan2(tx - c.x, tz - c.z);
        let dh = wantH - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += clamp(dh, -1.8 * dt, 1.8 * dt);
        const target = c.roadblock ? (d < 6 ? 0 : 16) : clamp(d * 0.55, 6, 34);
        c.speed += clamp(target - c.speed, -18 * dt, 10 * dt);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        const f = G.city.collide(c.x, c.z, 1.6); c.x = f.x; c.z = f.z;
        c.group.position.set(c.x, 0, c.z); c.group.rotation.y = c.heading;
        for (const w of c.wheels) w.rotation.x += c.speed * dt * 2;
        const flash = Math.floor(t * 6) % 2 === 0;
        c.barR.material.color.setHex(flash ? 0xff3b30 : 0x661111);
        c.barB.material.color.setHex(flash ? 0x112266 : 0x2f7bff);
        // ram the player
        if (d < 3 && !G.player.inCar) { G.combat.hurtPlayer(8 * dt * 10, 'ram'); }
        if (G.car && d < 3.4 && !G.shotMode) { G.car.hp -= 6 * dt * 10; G.car.speed *= 0.92; }
      });
      // foot cops chase + punch, busted if they hold the player
      for (const c of cops) {
        const d = Math.hypot(G.player.x - c.x, G.player.z - c.z);
        const wantH = Math.atan2(G.player.x - c.x, G.player.z - c.z);
        let dh = wantH - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += clamp(dh, -3 * dt, 3 * dt);
        const sp = d > 2 ? 4.6 : 0;
        c.x += Math.sin(c.heading) * sp * dt; c.z += Math.cos(c.heading) * sp * dt;
        c.phase += dt * sp * 2;
        c.group.position.set(c.x, 0, c.z); c.group.rotation.y = c.heading;
        c.legL.rotation.x = Math.sin(c.phase) * 0.6; c.legR.rotation.x = -Math.sin(c.phase) * 0.6;
        if (d < 2.2 && !G.player.inCar) {
          bustedT += dt;
          G.combat.hurtPlayer(4 * dt, 'cop');
          if (bustedT > 2.5) { G.phase = 'busted'; G.missions.failMission('DITANGKAP — the PCPD got you.'); }
        } else bustedT = Math.max(0, bustedT - dt);
      }
      // HUD units: spawned first, then en-route to 9 at wanted 4
      units.length = 0;
      const total = want === 0 ? 0 : want >= 4 ? 9 : want * 2 + 1;
      const all = [...cars.map((c) => ({ name: c.name, d: Math.round(Math.hypot(c.x - px, c.z - pz)), role: c.roadblock ? 'ROADBLOCK' : (Math.hypot(c.x - px, c.z - pz) < 12 ? 'RAMMING' : 'PURSUIT') }))];
      if (heli && heli.group.visible) all.unshift({ name: 'AIR-1', d: 17, role: 'SPOTLIGHT' });
      if (G.combat?.firedRecently()) all.push({ name: 'BARRACUDA-18', d: 21, role: 'FIRING' });
      for (let i = 0; i < Math.min(9, total); i++) {
        if (all[i]) units.push(all[i]);
        else units.push({ name: CONFIG.policeNames[(seq + i) % CONFIG.policeNames.length], d: 40 + i * 22, role: i % 3 === 0 ? 'ROADBLOCK' : 'PURSUIT' });
      }
      G.stats.maxWanted = Math.max(G.stats.maxWanted || 0, want);
    },
  };
}
