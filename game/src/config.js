// SOLARA BAY — tuning & content data. One place for every number the
// rest of the game reads, so a balance tweak never means hunting code.
export const CFG = {
  world: 640, half: 320,
  roadHalf: 7, sidewalk: 10,
  grid: [-240, -120, 0, 120, 240],
  ringEast: 312, ringSouth: 312, promenade: -258,
  trafficN: 36, pedN: 72, parkedN: 24, birdN: 22,
  walkSpeed: 4.2, runSpeed: 7.5, jumpV: 7.5, gravity: 20,
  camDist: 9, camHeight: 3.4,
  wantedMax: 5, heatCool: 10, heatClear: 20,
  sprayCost: 100, sprayPos: { x: 132, z: 60 },
  garage: { x: -60, z: -30 },
  spawn: { x: -240, z: 80, heading: Math.PI },
  velozPos: { x: -240, z: 66 },
  marcoPos: { x: -238, z: 64 },
  meetPos: { x: -240, z: 90 },
  pier: { x: -258, z: 20 }, boatPos: { x: -270, z: 20 },
  bonfire: { x: -258, z: 180 },
  lighthouse: { x: -292, z: 240 },
  ferris: { x: 60, z: 280 },
  sunCoins: 30, photoSpots: 3, stuntJumps: 3,
  startCash: 10000, startHealth: 100, startArmor: 0,
};

export const CAR_TYPES = {
  sedan:  { name: 'Cometa',    max: 38, accel: 14, grip: 2.6, color: 0x3f6fb5 },
  hatch:  { name: 'Pip',       max: 33, accel: 13, grip: 2.8, color: 0xe8b93c },
  taxi:   { name: 'Cabro',     max: 34, accel: 13, grip: 2.6, color: 0xf2c200 },
  van:    { name: 'Mula',      max: 28, accel: 10, grip: 2.2, color: 0x8a8f96 },
  sport:  { name: 'Veloz Comet RS', max: 52, accel: 20, grip: 3.4, color: 0xff2e7e },
  truck:  { name: 'Hauler',    max: 26, accel: 9,  grip: 2.0, color: 0x4a7a4a },
  bus:    { name: 'Solara Bus', max: 26, accel: 9, grip: 2.0, color: 0x2e7fb5 },
  taco:   { name: 'Taco Truck', max: 27, accel: 10, grip: 2.1, color: 0xe86a2e },
  police: { name: 'PCPD Interceptor', max: 46, accel: 18, grip: 3.2, color: 0x1a1d24 },
};

export const TRAFFIC_MIX = ['sedan', 'hatch', 'taxi', 'van', 'sport', 'sedan',
  'hatch', 'sedan', 'taxi', 'van', 'hatch', 'sport'];
export const TRAFFIC_PAINTS = [0xc22030, 0x3f6fb5, 0xe8b93c, 0x8a8f96, 0x2e8b6a,
  0xd86a2e, 0x7a4a9e, 0xdddddd, 0x222831, 0x4a90d9, 0xe07a9e, 0x5a7a3a];

export const WEAPONS = [
  { key: '1', name: 'FISTS',  ammo: Infinity, dmg: 12, rate: 0.35, range: 2.2, price: 0 },
  { key: '2', name: 'VESPER', ammo: 72,  dmg: 25, rate: 0.28, range: 34, price: 0 },
  { key: '3', name: 'MAKO',   ammo: 150, dmg: 14, rate: 0.09, range: 30, price: 0 },
  { key: '4', name: 'BREAKER', ammo: 24, dmg: 60, rate: 0.7, range: 40, price: 3800 },
  { key: '5', name: 'KESTREL', ammo: 40, dmg: 45, rate: 0.5, range: 60, price: 0, locked: true },
];

export const CALLSIGNS = ['IBIS-43', 'TARPON-10', 'HERON-17', 'KESTREL-31',
  'MARLIN-26', 'OSPREY-08', 'PELICAN-11', 'GECKO-25', 'BARRACUDA-18',
  'TAC-45', 'AIR-1', 'DOLPHIN-07'];

export const DISTRICTS = [
  { name: 'Malecón Celeste', test: (x) => x < -235 },
  { name: 'Marina Bay', test: (x, z) => z > 240 },
  { name: 'The Docks', test: (x) => x > 240 },
  { name: 'Vista Hills', test: (x, z) => z < -240 },
  { name: 'The Spires', test: (x, z) => Math.abs(x) < 120 && Math.abs(z) < 120 },
  { name: 'Old Solara', test: (x, z) => x < 0 && z > 0 },
  { name: 'Calle Verde', test: () => true },
];

export const RADIO_TRACKS = [
  'Malecón Mirage — Vela Roja', 'Pink Horizon — Lumen Kids',
  'Midnight Marina — Vela', 'Sunset Strip — The Palms',
  'Neon Drive — Coral Skies',
];

// 8 story missions. Steps: goto | talk | steal | drive | clear | stealTruck
// | follow | chase | race | party | boat. x/z are world metres.
export const MISSIONS = [
  { name: 'FIRST GEAR', client: 'Sal Vega', ch: 1,
    brief: 'Sal Vega: Nico, the VELOZ is parked on the Malecón. Take it, bring it to Mara\'s garage.',
    steps: [
      { type: 'goto', x: -240, z: 66, label: 'Reach the VELOZ Comet RS' },
      { type: 'steal', label: 'Steal the VELOZ (E)' },
      { type: 'drive', x: -60, z: -30, label: 'Drive the VELOZ to Mara\'s garage' },
    ], reward: 200 },
  { name: 'MEET MARCO', client: 'Marco', ch: 2,
    brief: 'Marco: Meet me at Marlin Ceviche, on the Malecón. We talk business.',
    steps: [
      { type: 'goto', x: -240, z: 90, label: 'Go to Marlin Ceviche' },
      { type: 'talk', npc: 'marco', x: -238, z: 64, label: 'Talk to Marco (E)' },
    ], reward: 150 },
  { name: 'COURIER RUN', client: 'Kip', ch: 3,
    brief: 'Kip: Three drops, four minutes. Don\'t scratch the paint. Timer is running.',
    steps: [
      { type: 'drive', x: 0, z: -180, label: 'Drop 1 — North gate' },
      { type: 'drive', x: 180, z: 60, label: 'Drop 2 — Docks road' },
      { type: 'drive', x: -60, z: 180, label: 'Drop 3 — Calle Verde' },
    ], timer: 240, reward: 400 },
  { name: 'THE DOCKS JOB', client: 'Sal Vega', ch: 4,
    brief: 'Sal Vega: Dario\'s guards watch the Hauler at the docks. Clear them, take the truck.',
    steps: [
      { type: 'goto', x: 210, z: 30, label: 'Reach the docks' },
      { type: 'clear', x: 216, z: 36, count: 3, label: 'Clear the guards (3)' },
      { type: 'stealTruck', x: 222, z: 36, label: 'Steal the Hauler (E)' },
      { type: 'drive', x: -60, z: -30, label: 'Bring the Hauler to the garage' },
    ], reward: 600 },
  { name: 'NEON NIGHTS', client: 'Kip', ch: 5,
    brief: 'Kip: Tail Dario\'s courier. Keep your distance — if he spots you, he runs.',
    steps: [
      { type: 'goto', x: -210, z: 120, label: 'Find the courier' },
      { type: 'follow', x: -210, z: 120, dur: 20, label: 'Tail the courier — stay back' },
      { type: 'chase', x: 120, z: -120, label: 'He spotted you! Chase him down' },
    ], timer: 300, reward: 500 },
  { name: 'STREET RACE', client: 'Marco', ch: 6,
    brief: 'Marco: Two rivals, four checkpoints, one winner. Horn means go.',
    steps: [
      { type: 'race', cps: [[-120, 0], [0, 120], [120, 0], [0, -120]], label: 'Win the street race' },
    ], timer: 105, reward: 350 },
  { name: 'BEACH PARTY', client: 'Lupe', ch: 7,
    brief: 'Lupe: The bonfire is lit on the beach. Come dance — the crew is waiting.',
    steps: [
      { type: 'goto', x: -258, z: 180, label: 'Go to the beach bonfire' },
      { type: 'party', x: -258, z: 180, dur: 5, label: 'Dance at the party' },
    ], reward: 250 },
  { name: 'GOLDEN HOUR', client: 'Lupe', ch: 8,
    brief: 'Lupe: Lose the manhunt before Marco\'s boat sails. The boat is at the pier.',
    steps: [
      { type: 'goto', x: -240, z: 66, label: 'Reach the VELOZ Comet RS' },
      { type: 'steal', label: 'Steal the VELOZ (E)' },
      { type: 'drive', x: -240, z: -120, label: 'Race down the Malecón' },
      { type: 'escape', label: 'Lose the cops before Marco\'s boat sails' },
      { type: 'boat', x: -270, z: 20, label: 'Reach the boat at the pier' },
    ], timer: 107, reward: 1000 },
];
