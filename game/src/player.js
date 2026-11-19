// Nico on foot: walk/run/jump, third-person camera, enter + steal cars.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, angLerp } from './random.js';

export function createPlayer(G) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a9d8f });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket); body.position.y = 1.15; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.38), new THREE.MeshLambertMaterial({ color: 0xffd24a })); stripe.position.y = 1.3; g.add(stripe);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin); head.position.y = 1.78; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 })); cap.position.y = 1.98; g.add(cap);
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.05), new THREE.MeshLambertMaterial({ color: 0x111111 })); glasses.position.set(0, 1.8, 0.19); g.add(glasses);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.08, 0.38), new THREE.MeshLambertMaterial({ color: 0x111111 })); belt.position.y = 0.74; g.add(belt);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants); legL.position.set(-0.16, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket); armL.position.set(-0.42, 1.15, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.05), new THREE.MeshLambertMaterial({ color: 0x5a3a1a })); strap.position.set(0.14, 1.2, 0.2); strap.rotation.z = 0.35; g.add(strap);
  const shoeM = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.4), shoeM); shoeL.position.set(-0.16, 0.05, 0.05); g.add(shoeL);
  const shoeR = shoeL.clone(); shoeR.position.x = 0.16; g.add(shoeR);
  G.scene.add(g);
  const P = {
    group: g, x: 0, z: 30, y: 0, vy: 0, heading: 0, camYaw: Math.PI, camPitch: 0.32, camDist: 9,
    walkPhase: 0, inCar: false,
    reset(x, z, yaw) { P.x = x; P.z = z; P.heading = yaw ?? Math.PI; P.camYaw = P.heading; P.vy = 0; P.y = 0; },
    update(dt) {
      if (P.inCar) { g.visible = false; if (G.car) { P.x = G.car.x; P.z = G.car.z; P.heading = G.car.heading; } return; }
      g.visible = true;
      const look = G.input.look();
      P.camYaw -= look.x * 0.0032; P.camPitch = clamp(P.camPitch + look.y * 0.0022, -0.1, 0.9);
      P.camDist = clamp(P.camDist + G.input.wheelDelta() * 0.01, 5, 16);
      if (G.input.pressed('KeyC')) P.camDist = P.camDist > 10 ? 7 : 13;
      const ax = G.input.axis();
      const run = G.input.down('ShiftLeft') || G.input.down('ShiftRight');
      const sp = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
      const mx = Math.sin(P.camYaw) * ax.y + Math.cos(P.camYaw) * ax.x;
      const mz = Math.cos(P.camYaw) * ax.y - Math.sin(P.camYaw) * ax.x;
      const moving = Math.hypot(mx, mz) > 0.01;
      if (moving) {
        P.heading = angLerp(P.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
        const nx = P.x + mx * sp * dt, nz = P.z + mz * sp * dt;
        const f = G.city.collide(nx, nz, 0.5);
        P.x = f.x; P.z = f.z;
        P.walkPhase += dt * sp * 1.6;
      }
      if (G.input.pressed('Space') && P.y <= 0.01) P.vy = CONFIG.jumpV;
      P.vy -= CONFIG.gravity * dt; P.y += P.vy * dt;
      if (P.y < 0) { P.y = 0; P.vy = 0; }
      const sw = moving ? Math.sin(P.walkPhase) * (run ? 0.8 : 0.55) : 0;
      legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
      g.position.set(P.x, P.y + Math.abs(Math.sin(P.walkPhase)) * (moving ? 0.06 : 0), P.z);
      g.rotation.y = P.heading;
      g.rotation.x = run && moving ? 0.12 : 0;
    },
    enterCar(car) {
      P.inCar = true; G.car = car; car.parked = false;
      G.audio.unlock();
      G.hud.prompt('');
    },
    exitCar() {
      if (!G.car) return;
      const car = G.car;
      P.inCar = false; G.car = null;
      P.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.4;
      P.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.4;
      P.heading = car.heading;
      const f = G.city.collide(P.x, P.z, 0.5); P.x = f.x; P.z = f.z;
    },
    stealCar(car) {
      if (car.driver) { // pull the driver out
        const d = car.driver; d.group.visible = true; d.x = car.x + 3; d.z = car.z + 2; d.flee = 4;
        car.driver = null;
      }
      if (G.police.cars.length > 0 || G.police.cops.length > 0) G.police.addWanted(1); // seen stealing
      G.stats.stolen++;
      P.enterCar(car);
      G.hud.ticker('You stole the ' + car.name);
    },
  };
  return P;
}
