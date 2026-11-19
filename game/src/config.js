// SOLARA BAY — tuning + shared live state. Every module reads CFG/G here.
import * as THREE from 'three';

export const CFG = {
  world: 640, half: 320, roadGap: 120, roadW: 14, walkW: 4,
  roads: [-240, -120, 0, 120, 240],
  walk: 6, run: 10.5, jump: 7.5, grav: 22,
  taxiFare: 40, racePrize: 120, fishPrice: 15, photoBonus: 60, courierPay: 60,
  respray: 100, maxWanted: 5, heatCool: 10, hideCool: 20,
  trafficN: 16, pedN: 36, parkedN: 12, birdN: 10,
  startCash: 10350, startPos: { x: -240, z: 80 },
  radio: 'CELESTE 98.1',
  tracks: ['Malecón Mirage — Vela Roja', 'Sunset Strip — The Palms', 'Neon Drive — Coral Skies', 'Midnight Marina — Vela'],
  fish: [
    { name: 'Sarden', w: 1 }, { name: 'Kakap', w: 3 },
    { name: 'Tuna Kecil', w: 5 }, { name: 'Marlin Muda', w: 9 },
  ],
  photoSpots: [
    { id: 0, name: 'Mercusuar', x: -288, z: -262 },
    { id: 1, name: 'Dermaga Tua', x: -296, z: 96 },
    { id: 2, name: 'Plaza Spires', x: 118, z: 118 },
    { id: 3, name: 'Pasar Old Solara', x: -122, z: -118 },
    { id: 4, name: 'Atap Docks', x: 252, z: -178 },
    { id: 5, name: 'Pantai Selatan', x: -272, z: 208 },
  ],
  fishSpots: [
    { id: 0, name: 'Ujung Dermaga', x: -298, z: 44 },
    { id: 1, name: 'Dermaga Kayu', x: -296, z: 88 },
  ],
  raceStart: { x: 0, z: -180 }, raceLaps: 1,
  garage: { x: 96, z: -96 }, spray: { x: 132, z: 60 },
  restaurant: { x: -238, z: 64 }, pier: { x: -296, z: 44 },
  beachParty: { x: -272, z: 150 },
  carTypes: {
    sport: { name: 'VELOZ COMET RS', color: 0xff2e7e, top: 52, accel: 26, grip: 2.6, len: 4.4, wid: 2.0 },
    taxi: { name: 'TAXI SOLARA', color: 0xf5c518, top: 38, accel: 20, grip: 2.2, len: 4.4, wid: 2.0 },
    sedan: { name: 'COMETA SEDAN', color: 0x2e6fd8, top: 40, accel: 21, grip: 2.3, len: 4.5, wid: 2.0 },
    van: { name: 'MULA VAN', color: 0xe8e4d8, top: 32, accel: 15, grip: 1.9, len: 5.0, wid: 2.2 },
    truck: { name: 'HAULER', color: 0xd86a1e, top: 30, accel: 13, grip: 1.7, len: 6.2, wid: 2.4 },
    bus: { name: 'BUS SOLARA', color: 0x1e9e6a, top: 28, accel: 11, grip: 1.6, len: 8.0, wid: 2.5 },
    police: { name: 'PCPD INTERCEPTOR', color: 0x11151c, top: 48, accel: 25, grip: 2.5, len: 4.6, wid: 2.0 },
  },
};

// Live state shared by all modules. Plain data + three refs; no logic here.
export const G = {
  phase: 'title', // title | play | pause | over | busted
  timeOfDay: 17.5, day: 1, elapsed: 0, frames: 0,
  cash: CFG.startCash, wanted: 0, heat: 0, hiddenT: 0,
  health: 100, armor: 0, weapon: 0, ammo: [0, 72, 150, 0],
  weapons: ['FISTS', 'VESPER 72', 'MAKO SMG', 'BREAKER', 'KESTREL'],
  respect: 1, muted: false, touchMode: false, shotMode: false, shotName: '',
  missionIdx: 0, missionStage: 0, missionTimer: 0, missionTitle: '', objective: '',
  dialogUntil: 0, prompt: '',
  player: {
    pos: new THREE.Vector3(CFG.startPos.x, 0, CFG.startPos.z),
    heading: 0, speed: 0, vy: 0, grounded: true, car: null, onFoot: true,
  },
  camYaw: 0, camPitch: -0.32, camDist: 9,
  cars: [], traffic: [], police: [], peds: [], enemies: [], vendors: [],
  colliders: [], signs: [], neonHalos: [], lamps: [], birds: [],
  stats: { stolen: 0, missionsDone: 0, taxi: 0, races: 0, fish: 0, fishKinds: [], photos: [], courier: 0, kills: 0, distance: 0, playT: 0 },
  taxi: { active: false, px: 0, pz: 0, dx: 0, dz: 0, stage: 0, ped: null },
  race: { active: false, cp: 0, t: 0, rivals: [] },
  fish: { active: false, needle: 0, dir: 1, spot: 0, caught: '' },
  courier: { active: false, dx: 0, dz: 0, t: 0 },
  scene: null, camera: null, renderer: null, sun: null, hemi: null,
  skyMat: null, sunSprite: null, moonSprite: null, stars: null, clouds: [],
  city: null, heli: null, minimap: null, ui: {},
  seed: 8, shotFrames: 0, shotReady: false, interact: null, nearMsg: '',
  marcos: null, photoFlash: 0,
};
