// SOLARA BAY — tuning & data. Semua angka gameplay terpusat di sini.
export const CONFIG = {
  seed: 8,
  worldHalf: 300,
  roadHalf: 7,
  roads: [-240, -120, 0, 120, 240],
  walkSpeed: 4.2, runSpeed: 7.5, jumpSpeed: 7.5, gravity: 22,
  carAccel: 16, carBrake: 30, carMaxReverse: 9, carDrag: 0.55,
  steerMax: 0.55, handbrakeGrip: 0.35,
  trafficCount: 20, pedCount: 36, parkedCount: 16,
  wantedDecay: 10, wantedHide: 20, resprayCost: 100,
  sunCoinCount: 30, taxiFares: 3, stuntJumps: 3,
  raceDuration: 90, racePrize: 2000,
  fishTime: 6, fishChance: 0.65, fishMin: 10, fishMax: 40,
  dayLength: 180, startTime: 17.2,
  cashStart: 10350,
};

export const CAR_TYPES = {
  sedan:  { name: 'Cometa',        color: 0x3a7bd5, top: 26, accel: 14, grip: 1.0,  hp: 100 },
  hatch:  { name: 'Pip',           color: 0xf2c14e, top: 24, accel: 13, grip: 1.05, hp: 90 },
  taxi:   { name: 'Cabro',         color: 0xf5c518, top: 25, accel: 13, grip: 1.0,  hp: 100 },
  van:    { name: 'Mula',          color: 0x8a94a6, top: 22, accel: 11, grip: 0.9,  hp: 140 },
  sport:  { name: 'Veloz Comet RS',color: 0xff2e7e, top: 38, accel: 20, grip: 1.15, hp: 110 },
  truck:  { name: 'Hauler',        color: 0x5a6b52, top: 20, accel: 10, grip: 0.85, hp: 180 },
  bus:    { name: 'Solara Bus',    color: 0x2e9e7e, top: 21, accel: 9,  grip: 0.8,  hp: 200 },
  taco:   { name: 'Taco Truck',    color: 0xe86a1c, top: 21, accel: 10, grip: 0.85, hp: 150 },
  police: { name: 'PCPD Interceptor', color: 0x11151c, top: 34, accel: 19, grip: 1.1, hp: 130 },
};

export const WEAPONS = {
  1: { name: 'FISTS',   ammo: Infinity, price: 0,    owned: true,  dmg: 12, rate: 0.45, auto: false },
  2: { name: 'VESPER',  ammo: 72,  price: 0,    owned: true,  dmg: 18, rate: 0.32, auto: false },
  3: { name: 'MAKO',    ammo: 150, price: 0,    owned: false, dmg: 11, rate: 0.09, auto: true },
  4: { name: 'BREAKER', ammo: 24,  price: 3800, owned: false, dmg: 55, rate: 0.9,  auto: false },
  5: { name: 'KESTREL', ammo: 40,  price: 0,    owned: false, dmg: 40, rate: 0.5,  auto: false, locked: true },
};

export const CALLSIGNS = [
  'PELICAN-11', 'GECKO-25', 'BARRACUDA-18', 'TAC-45', 'IBIS-43',
  'TARPON-19', 'HERON-17', 'KESTREL-31', 'MARLIN-26', 'OSPREY-08',
];

export const RADIO = {
  station: 'CELESTE 98.1',
  tracks: [
    'Malecón Mirage · Vela Roja', 'Midnight Marina · Vela',
    'Sunset Strip · The Palms', 'Neon Drive · Coral Skies',
  ],
};

export const RESPECT_TITLES = ['ROOKIE', 'HUSTLER', 'DRIVER', 'SHOT CALLER', 'LEGEND'];
export const RESPECT_MAX = 550;

export const DISTRICTS = [
  { name: 'Malecón Celeste', test: (x, z) => x < -180 },
  { name: 'Marina Bay',      test: (x, z) => z > 180 },
  { name: 'The Docks',       test: (x, z) => x > 120 && z < -120 },
  { name: 'Vista Hills',     test: (x, z) => z < -180 },
  { name: 'The Spires',      test: (x, z) => x > 120 },
  { name: 'Calle Verde',     test: (x, z) => z < 0 },
  { name: 'Old Solara',      test: () => true },
];

export const MISSIONS = [
  { name: 'FIRST GEAR', client: 'Marco', reward: 500,
    brief: 'Marco: Nico! You are back. Steal a ride and bring it to my garage — welcome home.' },
  { name: 'COURIER RUN', client: 'Lupe', reward: 1200,
    brief: 'Lupe: Three packages, four minutes. Traffic is your problem, not mine.' },
  { name: 'THE DOCKS JOB', client: 'Marco', reward: 2500,
    brief: 'Marco: A Hauler full of cargo sits at the docks. Four guards. Make it quick, make it quiet — or loud, your call.' },
  { name: 'NEON NIGHTS', client: 'Lupe', reward: 3000,
    brief: 'Lupe: Tail the courier. Stay back, stay dark. When he runs, run him down.' },
  { name: 'STREET HEAT', client: 'Marco', reward: 4000,
    brief: 'Marco: Two punks on the Malecón think they own the boulevard. Show them what a Comet RS does.' },
  { name: 'HARBOR LIGHTS', client: 'Lupe', reward: 3500,
    brief: 'Lupe: A crate at the docks needs to reach the pier. Walk it to the end — the boat is waiting.' },
  { name: 'MEET MARCO AT MARLIN CEVICHE', client: 'Marco', reward: 5000,
    brief: 'Marco: Meet me at Marlin Ceviche on the Malecón. I have something for you — the Kestrel.' },
  { name: 'GOLDEN HOUR', client: 'Lupe', reward: 25000,
    brief: 'Lupe: Last job, Nico. Lose the manhunt before Marco\u2019s boat sails. The whole department is coming.' },
];

export const SHOP_SIGNS = [
  ['TACOS', '#ffd23e', '#7a1f2b'], ['DONUTS', '#ff9ecf', '#3b1f4d'],
  ['BAR', '#7ef0d4', '#12233a'], ['HOTEL', '#7fd4ff', '#1c2a4a'],
  ['PIZZA', '#ff8a3d', '#3a1c10'], ['24H MART', '#b6ff5e', '#1e3a12'],
];
export const NEON_SIGNS = [
  { text: 'FLAMINGO FM', color: '#ff4da6', x: -252, z: 30 },
  { text: 'VICE HOTEL', color: '#37e0ff', x: 120, z: -252 },
  { text: 'TACOS 24H', color: '#ffd23e', x: -252, z: -150 },
  { text: 'MARLIN CEVICHE', color: '#ff7a5c', x: -248, z: 90 },
  { text: 'CELESTE 98.1', color: '#ff5fa2', x: -252, z: 210 },
];
