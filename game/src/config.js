// SOLARA BAY — tuning constants + shared mutable game state (G).
// Every module imports G from here, so there are no circular imports.
// NOTE: the mission state object is G.msn — never name anything G.mission.
export const CFG = {
  world: 640, half: 320,
  roads: [-240, -120, 0, 120, 240],
  ringE: 312, ringS: 312, prom: -258,
  roadW: 12,
  trafficN: 36, pedN: 72, crowdN: 78, parkedN: 24, birdN: 22,
  palmRows: 2, shadeTrees: 24,
  walkSpeed: 5, runSpeed: 9, jumpV: 7,
  carAccel: 22, carBrake: 34, carMax: 46, carReverse: 12,
  sportMax: 58, truckMax: 34, vanMax: 38, taxiMax: 44,
  wantedDecaySeen: 10, wantedClearHidden: 20,
  sprayCost: 100, sprayPos: [132, 60],
  garagePos: [120, -120], garageName: "Mara's Garage",
  meetPos: [-240, 90], marcoPos: [-240, 87],
  spawnPos: [-240, 80], velozPos: [-240, 66],
  pierPos: [-292, 60], boatPos: [-296, 140],
  lighthousePos: [-292, 200], ferrisPos: [-285, 120],
  docksPos: [240, 180], raceStart: [0, 240],
  beachPos: [-258, 200],
  coinsN: 30, photoSpots: [[-258, 20], [0, 0], [-285, 120], [120, 120]],
  radio: 'CELESTE 98.1',
  tracks: ['Malecón Mirage · Vela Roja', 'Midnight Marina · Vela',
    'Sunset Strip · The Palms', 'Neon Drive · Coral Skies'],
  prices: { spray: 100, gun: 800, smg: 1800, armor: 250 },
};
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const angLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
export const fmtCash = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
// Shared mutable state. Fields are attached by modules as the game boots.
export const G = {
  phase: 'title', // title | play | pause | over
  seed: 8, shotMode: false, shotScene: '',
  timeOfDay: 17.5, day: 1, nightF: 0,
  cash: 10350, wanted: 0, heat: 0, hiddenT: 0,
  health: 100, armor: 0, weapon: 0,
  ammo: [Infinity, 72, 150, 6], mag: [Infinity, 12, 30, 1],
  msn: { idx: 0, stage: 0, timer: 0, objective: '', next: '', active: false },
  stats: { missionsDone: 0, carsStolen: 0, photos: 0, fish: 0, taxiDone: 0,
    raceWins: 0, coins: 0, maxWanted: 0, playTime: 0, jumps: 0 },
  act: { taxi: null, race: null, fishing: 0, photoCd: 0 },
  player: null, cars: [], traffic: [], peds: [], police: [], guards: [],
  coins: [], colliders: [], neonHalos: [], trafficLights: [], birds: [],
  policeUnits: [], heli: null, _policeSeq: 0,
  camYaw: 0, camDist: 9, camPitch: 0.32,
  dialogUntil: 0, toastUntil: 0, overKind: '',
  touch: { active: false, moveX: 0, moveY: 0, camDX: 0 },
  muted: false, elapsed: 0, frame: 0,
  scene: null, renderer: null, camera: null,
  sun: null, hemi: null, skyMat: null, sunGlow: null, stars: null, moon: null,
  bursts: [], interact: null, nearCar: null, nearNpc: null,
};
export function resetRun() {
  G.phase = 'play'; G.timeOfDay = 17.5; G.day = 1;
  G.cash = 10350; G.wanted = 0; G.heat = 0; G.hiddenT = 0;
  G.health = 100; G.armor = 0; G.weapon = 0;
  G.ammo = [Infinity, 72, 150, 6]; G.mag = [Infinity, 12, 30, 1];
  G.msn = { idx: 0, stage: 0, timer: 0, objective: '', next: '', active: true };
  G.stats = { missionsDone: 0, carsStolen: 0, photos: 0, fish: 0, taxiDone: 0,
    raceWins: 0, coins: 0, maxWanted: 0, playTime: 0, jumps: 0 };
  G.act = { taxi: null, race: null, fishing: 0, photoCd: 0 };
  G.police = []; G.guards = []; G.policeUnits = [];
  G.dialogUntil = 0; G.overKind = ''; G.elapsed = 0;
}
