// Wanted system 0–5 stars + police AI: foot cops at 1 star, patrol cars
// at 2+, chase/ram/block, heat decays when unseen, Spray & Shine clears.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createCarMesh } from './vehicles.js';
import { rand } from './random.js';
import { damagePlayer } from './combat.js';

export function createPolice(scene, rng) {
  const police = {
    wanted: 0, hiddenTimer: 0, spawnTimer: 0, cars: [], foot: [],
    addWanted(S, n) {
      this.wanted = Math.min(5, this.wanted + n);
      S.stats.maxWanted = Math.max(S.stats.maxWanted, this.wanted);
      this.hiddenTimer = 0;
    },
    clearWanted(S) {
      this.wanted = 0;
      for (const c of this.cars) { S.scene.remove(c.group); const i = S.cars.indexOf(c); if (i >= 0) S.cars.splice(i, 1); }
      this.cars = [];
      for (const f of this.foot) S.scene.remove(f.mesh);
      this.foot = [];
    },
    spawnPoliceCar(S) {
      const car = createCarMesh('sedan', 0x1a2a4a);
      const p = S.player.mesh.position;
      const ang = rand(rng, 0, Math.PI * 2);
      car.group.position.set(p.x + Math.cos(ang) * 55, 0, p.z + Math.sin(ang) * 55);
      car.driver = 'police'; car.hp = 120;
      // Light bar.
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
      bar.position.y = 1.15; car.group.add(bar);
      S.scene.add(car.group); S.cars.push(car); this.cars.push(car);
      S.audio.honk();
    },
    spawnFootCop(S) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
      body.position.y = 1.2; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 2; g.add(head);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x0a1a3a }));
      cap.position.y = 2.28; g.add(cap);
      const p = S.player.mesh.position;
      g.position.set(p.x + rand(rng, -30, 30), 0, p.z + rand(rng, -30, 30));
      S.scene.add(g); this.foot.push({ mesh: g, punchTimer: 1 });
    },
    nearestDist(S) {
      let best = Infinity;
      const p = S.player.mesh.position;
      for (const c of this.cars) best = Math.min(best, c.group.position.distanceTo(p));
      for (const f of this.foot) best = Math.min(best, f.mesh.position.distanceTo(p));
      return best;
    },
    update(S, dt) {
      const p = S.player.mesh.position;
      const wantCars = this.wanted >= 2 ? Math.min(3, this.wanted - 1) : 0;
      const wantFoot = this.wanted >= 1 ? Math.min(3, this.wanted) : 0;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 4;
        if (this.cars.length < wantCars) this.spawnPoliceCar(S);
        if (this.foot.length < wantFoot) this.spawnFootCop(S);
      }
      // Police cars chase and ram.
      for (const car of this.cars) {
        const d = car.group.position.distanceTo(p);
        const dir = p.clone().sub(car.group.position); dir.y = 0;
        const targetYaw = Math.atan2(dir.x, dir.z);
        let dy = targetYaw - car.group.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        car.group.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
        car.speed = Math.min(38, car.speed + 16 * dt);
        car.group.position.x += Math.sin(car.group.rotation.y) * car.speed * dt;
        car.group.position.z += Math.cos(car.group.rotation.y) * car.speed * dt;
        if (d < 3.2 && S.phase === 'playing') {
          damagePlayer(S, 4);
          if (S.player.inCar) { car.speed *= 0.5; S.player.car.speed *= 0.6; }
        }
      }
      // Foot cops chase and punch.
      for (const f of this.foot) {
        const d = f.mesh.position.distanceTo(p);
        const dir = p.clone().sub(f.mesh.position); dir.y = 0; dir.normalize();
        if (d > 1.6) f.mesh.position.addScaledVector(dir, 4.4 * dt);
        f.mesh.lookAt(p.x, 0, p.z);
        f.punchTimer -= dt;
        if (d < 2 && f.punchTimer <= 0) { f.punchTimer = 1; damagePlayer(S, 6); S.audio.punch(); }
      }
      // Heat decay: unseen 10 s drops a star, 20 s hidden clears all.
      const near = this.nearestDist(S);
      if (this.wanted > 0 && near > 60) {
        this.hiddenTimer += dt;
        if (this.hiddenTimer > CONFIG.hideSeconds && this.hiddenTimer < CONFIG.clearSeconds) {
          this.wanted = Math.max(0, this.wanted - 1); this.hiddenTimer = 0;
          S.hud.showPrompt('Heat cooling off…');
        } else if (this.hiddenTimer >= CONFIG.clearSeconds) {
          this.clearWanted(S); S.hud.showPrompt('You lost them!');
        }
      } else this.hiddenTimer = 0;
      // Spray & Shine: drive through to clear stars for $100/star.
      if (this.wanted > 0 && Math.hypot(p.x - 80, p.z + 88) < 8) {
        const cost = this.wanted * CONFIG.resprayPerStar;
        if (S.player.cash >= cost) {
          S.player.cash -= cost; this.clearWanted(S);
          S.hud.showPrompt(`Resprayed — $${cost}. Clean!`);
        } else S.hud.showPrompt(`Spray & Shine: $${cost} to clear ${this.wanted}★`);
      }
    },
  };
  return police;
}
