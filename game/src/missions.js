// 5 story missions + side activities (taxi fares, stunt jumps, sun coins,
// garage). Each mission: briefing dialog, ordered checkpoints, fail/retry.
import * as THREE from 'three';
import { rand } from './random.js';

export const MISSIONS = [
  { id: 1, name: 'First Gear', who: 'Sal Vega', brief: 'Ro, welcome home. Steal the parked Cometa by the market, then bring it to Mara’s garage. Keep it clean — one star and the cops will notice.', reward: 200, objectives: [{ text: 'Steal the parked car (E)', x: -104, z: -104, r: 6 }, { text: 'Drive to Mara’s garage', x: 96, z: -64, r: 8 }] },
  { id: 2, name: 'Courier Run', who: 'Kip', brief: 'Meet Marco at Marlin Ceviche in Old Solara — he has the parcels. Then drop all 3 parcels at the checkpoints in 4 minutes. Don’t smash the packages.', reward: 350, objectives: [{ text: 'Meet Marco at Marlin Ceviche (E — talk)', x: -80, z: -160, r: 6 }, { text: 'Deliver parcel 1 — The Spires', x: 80, z: -80, r: 8 }, { text: 'Deliver parcel 2 — Calle Verde', x: -40, z: 200, r: 8 }, { text: 'Deliver parcel 3 — Marina Bay', x: -260, z: 40, r: 8 }], timer: 240 },
  { id: 3, name: 'The Docks Job', who: 'Sal Vega', brief: 'Dario’s crew guards a Hauler at the Docks. Take it. Four guards, two stars on the way out — bring the truck to the garage.', reward: 500, objectives: [{ text: 'Reach the Docks', x: 200, z: 160, r: 10 }, { text: 'Clear the guards and steal the Hauler', x: 220, z: 180, r: 10 }, { text: 'Escape to the garage', x: 96, z: -64, r: 8 }] },
  { id: 4, name: 'Neon Nights', who: 'Kip', brief: 'Night run. Tail Dario’s courier from the Spires — stay close but don’t get spotted. When he bolts, chase him down. Three stars if it goes loud.', reward: 600, objectives: [{ text: 'Tail the courier (stay within 30 m)', x: 80, z: -80, r: 12 }, { text: 'Chase the courier to the Docks', x: 200, z: 160, r: 10 }, { text: 'Grab the package', x: 220, z: 200, r: 6 }], night: true },
  { id: 5, name: 'Bay Heist', who: 'Mara Voss', brief: 'The finale. Lift the show car — a Veloce GT Aurelia — from the Spires penthouse garage. Four stars, one long chase, deliver it to the pier. Debt paid. Dario loses.', reward: 1200, objectives: [{ text: 'Reach the penthouse garage', x: 80, z: -80, r: 8 }, { text: 'Steal the Aurelia', x: 96, z: -96, r: 6 }, { text: 'Lose the heat and reach the pier', x: -320, z: -40, r: 10 }] },
];

export const TAXI_FARES = [
  { from: [-80, -80], to: [200, 160], pay: 80 },
  { from: [80, -80], to: [-260, 40], pay: 90 },
  { from: [-40, 200], to: [160, -220], pay: 100 },
];
export const STUNT_JUMPS = [[-160, 0], [0, -160], [160, 160]];

export function createMissions(S) {
  const m = {
    current: 0, stage: 0, timer: 0, active: false, beacon: null, coins: [], collected: 0,
    garage: [], taxi: 0, jumps: 0,
    start(index) {
      const def = MISSIONS[index];
      if (!def) return;
      this.current = index; this.stage = 0; this.active = true;
      this.timer = def.timer || 0;
      if (def.night) S.timeHours = 21.5;
      if (def.id === 3) S.combat.spawnGuards(new THREE.Vector3(220, 0, 180), 4);
      if (def.id === 5) S.spawnShowCar();
      S.hud.showDialog(def.who, def.brief);
      S.hud.setObjective(`${def.name} — ${def.objectives[0].text}`);
      this.placeBeacon(def.objectives[0]);
      S.audio.jingle();
    },
    placeBeacon(obj) {
      if (this.beacon) S.scene.remove(this.beacon);
      const geo = new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
      this.beacon = new THREE.Mesh(geo, mat);
      this.beacon.position.set(obj.x, 30, obj.z);
      S.scene.add(this.beacon);
    },
    advance() {
      const def = MISSIONS[this.current];
      this.stage++;
      if (this.stage >= def.objectives.length) { this.complete(); return; }
      const obj = def.objectives[this.stage];
      S.hud.setObjective(`${def.name} — ${obj.text}`);
      this.placeBeacon(obj);
      S.audio.coin();
    },
    complete() {
      const def = MISSIONS[this.current];
      this.active = false;
      if (this.beacon) { S.scene.remove(this.beacon); this.beacon = null; }
      S.player.cash += def.reward;
      S.stats.missionsDone++;
      S.hud.showMissionEnd(`${def.name} — MISSION PASSED`, `+$${def.reward}. ${this.current + 1 < MISSIONS.length ? 'Next job: ' + MISSIONS[this.current + 1].name : 'Debt paid. Dario Kane loses. Solara Bay is yours, Ro.'}`);
      S.audio.jingle();
      S.saveGame();
    },
    fail(reason) {
      this.active = false;
      if (this.beacon) { S.scene.remove(this.beacon); this.beacon = null; }
      S.audio.fail();
      S.gameOver('MISSION FAILED', reason);
    },
    spawnCoins() {
      const geo = new THREE.SphereGeometry(0.6, 10, 8);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0xaa7700 });
      for (let i = 0; i < 30; i++) {
        const c = new THREE.Mesh(geo, mat);
        const x = rand(S.rng, -280, 280), z = rand(S.rng, -280, 280);
        c.position.set(x, 1.2, z); S.scene.add(c);
        this.coins.push(c);
      }
    },
    update(dt) {
      if (this.beacon) this.beacon.rotation.y += dt * 0.8;
      if (!this.active) return;
      const def = MISSIONS[this.current];
      if (this.timer > 0) {
        this.timer -= dt;
        if (this.timer <= 0) { this.fail('Time ran out on the Courier Run.'); return; }
      }
      const obj = def.objectives[this.stage];
      if (!obj) return;
      const p = S.player.mesh.position;
      const d = Math.hypot(p.x - obj.x, p.z - obj.z);
      if (d < obj.r) {
        if (def.id === 2 && this.stage === 0 && !S.player.nearMarco) { S.hud.showPrompt('E — Talk to Marco'); return; }
        this.advance();
      }
      // Mission 3: guards must be cleared before the truck counts.
      if (def.id === 3 && this.stage === 1 && S.combat.enemies.length > 0) return;
    },
    collectCoins() {
      const p = S.player.mesh.position;
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        if (c.visible && Math.hypot(p.x - c.position.x, p.z - c.position.z) < 2.5) {
          c.visible = false; this.coins.splice(i, 1);
          this.collected++; S.player.cash += 20; S.audio.coin();
          S.hud.showPrompt('+ $20 sun coin');
        }
      }
    },
  };
  return m;
}
