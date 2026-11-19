// SOLARA BAY — tuning + state bersama. Semua modul impor G dari sini.
export const CFG = {
  world: 300, roadAt: [-240, -120, 0, 120, 240], roadW: 12,
  walkSpeed: 6, runSpeed: 10, jumpV: 7,
  carAccel: 16, carBrake: 30,
  carMax: { sedan: 34, sport: 46, taxi: 32, truck: 26, van: 30, bus: 24, police: 40 },
  carTurn: 1.9, trafficCount: 22, pedCount: 90, parkedCount: 16,
  taxiFare: 40, racePrize: 120, fishPrice: 15, photoBonus: 60, respray: 100,
};
export const CAR_TYPES = {
  sedan: { name: 'Cometa', color: 0x3a7bd5, top: 34, acc: 15 },
  sport: { name: 'VELOZ COMET RS', color: 0xff2e7e, top: 46, acc: 19 },
  taxi: { name: 'Cabro Taxi', color: 0xf5c518, top: 32, acc: 15 },
  truck: { name: 'Hauler', color: 0xc96a1e, top: 26, acc: 11 },
  van: { name: 'Mula Van', color: 0x7d8a99, top: 30, acc: 13 },
  bus: { name: 'Solara Bus', color: 0x2e9e6b, top: 24, acc: 10 },
  police: { name: 'PCPD Interceptor', color: 0x1a1d24, top: 40, acc: 18 },
};
export const DISTRICTS = [
  { name: 'Malecón Celeste', x0: -300, z0: -300, x1: -200, z1: 300 },
  { name: 'Marina Bay', x0: -200, z0: -300, x1: -60, z1: -60 },
  { name: 'Old Solara', x0: -200, z0: -60, x1: -60, z1: 180 },
  { name: 'The Spires', x0: -60, z0: -300, x1: 180, z1: -60 },
  { name: 'The Docks', x0: 180, z0: -300, x1: 300, z1: -60 },
  { name: 'Vista Hills', x0: -60, z0: 180, x1: 300, z1: 300 },
  { name: 'Calle Verde', x0: -200, z0: 180, x1: -60, z1: 300 },
];
export const G = {
  ready: false, state: 'title', paused: false, time: 0, timeOfDay: 17.4, day: 1,
  cash: 10350, wanted: 0, heat: 0, health: 100, armor: 0, weapon: 0, ammo: [Infinity, 72, 150],
  missionIdx: 0, missionStep: 0, missionTimer: 0, missionsDone: 0, respect: 1,
  player: { x: 0, z: 36, y: 0, yaw: Math.PI, vy: 0, onGround: true, mesh: null, speed: 0 },
  camYaw: Math.PI, camDist: 9, car: null, vehicles: [], traffic: [], peds: [], police: [],
  heli: null, birds: [], clouds: [], coins: 0, photos: [], fish: [], fishCaught: {},
  taxi: { active: false, phase: '', tx: 0, tz: 0, t: 0, fare: 0, done: 0 },
  race: { active: false, step: 0, t: 0, rivals: [], place: 0, done: 0 },
  fishing: { active: false, spot: -1, bar: 0, dir: 1, hits: 0, need: 3 },
  sideJob: { active: false, tx: 0, tz: 0, t: 0, done: 0 },
  dialog: null, objective: '', prompt: '', toast: '', toastT: 0,
  nightF: 0, sunsetF: 0, muted: false, stats: { stolen: 0, busted: 0, playT: 0 },
  city: null, scene: null, renderer: null, camera: null, sun: null, hemi: null,
  skyMat: null, sunSprite: null, moonSprite: null, stars: null, keys: {},
  touch: { active: false, joyX: 0, joyY: 0, camDrag: false },
  seed: 1, shot: '',
};
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  return 'Solara Bay';
}
export function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
