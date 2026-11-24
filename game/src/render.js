// Renderer: three.js scene, chase camera, day–night sky + sun, fog,
// headlights at night, neon glow, simple particle bursts.
import * as THREE from 'three';

export function createWorldRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x9db8cc, 180, 520);
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 1200);
  camera.position.set(0, 8, 14);

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(120, 160, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbdd8f2, 0x4a5a3a, 0.9));
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0);
  moon.position.set(-80, 120, -40); scene.add(moon);

  // Headlight spotlights for the player's car at night.
  const headL = new THREE.SpotLight(0xfff2c8, 0, 40, 0.5, 0.5);
  const headR = new THREE.SpotLight(0xfff2c8, 0, 40, 0.5, 0.5);
  scene.add(headL); scene.add(headR); scene.add(headL.target); scene.add(headR.target);

  const R = {
    renderer, scene, camera, sun, moon, headL, headR,
    camDist: 10, camIndex: 0, camDists: [7, 10, 14],
    cycleCamera() { this.camIndex = (this.camIndex + 1) % this.camDists.length; this.camDist = this.camDists[this.camIndex]; },
    update(S, dt) {
      // Day–night: sun angle from the in-game hour.
      const h = S.timeHours;
      const dayFrac = ((h - 6) / 12 + 1) % 1; // 0 dawn, .5 noon, 1 dusk
      const sunAlt = Math.sin(dayFrac * Math.PI);
      const isNight = h < 6 || h >= 19;
      const dusk = h >= 16.5 && h < 19.5;
      const dawn = h >= 5 && h < 7.5;
      if (isNight) {
        scene.background.setHex(0x0b1026); scene.fog.color.setHex(0x0b1026);
        sun.intensity = 0.12; moon.intensity = 0.5;
      } else if (dusk) {
        scene.background.setHex(0xe8915a); scene.fog.color.setHex(0xe8915a);
        sun.intensity = 1.1; moon.intensity = 0;
      } else if (dawn) {
        scene.background.setHex(0xf2b27a); scene.fog.color.setHex(0xf2b27a);
        sun.intensity = 1.4; moon.intensity = 0;
      } else {
        scene.background.setHex(0x87b5e0); scene.fog.color.setHex(0x9db8cc);
        sun.intensity = 2.2; moon.intensity = 0;
      }
      sun.position.set(Math.cos(dayFrac * Math.PI * 2) * 160, 40 + sunAlt * 160, 80);
      // Neon signs + lamp heads glow at night.
      const glow = isNight ? 1 : 0;
      for (const s of S.city.signs) s.material.emissive?.setHex(isNight ? 0x661144 : 0x000000);
      // Headlights.
      const car = S.player.inCar ? S.player.car : null;
      const on = isNight && car;
      this.headL.intensity = on ? 60 : 0; this.headR.intensity = on ? 60 : 0;
      if (on) {
        const gp = car.group.position, yaw = car.group.rotation.y;
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        this.headL.position.copy(gp).addScaledVector(fwd, 2).addScaledVector(right, 0.7).add(new THREE.Vector3(0, 1, 0));
        this.headR.position.copy(gp).addScaledVector(fwd, 2).addScaledVector(right, -0.7).add(new THREE.Vector3(0, 1, 0));
        this.headL.target.position.copy(gp).addScaledVector(fwd, 30);
        this.headR.target.position.copy(gp).addScaledVector(fwd, 30);
      }
      this.updateCamera(S, dt);
    },
    updateCamera(S, dt) {
      const p = S.player;
      const target = p.inCar && p.car ? p.car.group.position : p.mesh.position;
      const yaw = p.inCar && p.car ? p.car.group.rotation.y : S.input.lookYaw;
      const pitch = S.input.lookPitch;
      const dist = this.camDist;
      const cx = target.x - Math.sin(yaw) * dist * Math.cos(pitch);
      const cz = target.z - Math.cos(yaw) * dist * Math.cos(pitch);
      const cy = target.y + 3.2 + dist * 0.32 + pitch * 4;
      // Smooth follow.
      camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
      camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 6);
      camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 6);
      camera.lookAt(target.x, target.y + 1.6, target.z);
      const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
      if (camera.aspect !== w / h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); }
    },
  };
  return R;
}
