// Tuning + world data for SOLARA BAY. All numbers come from the design spec.
export const CFG = {
  world: 640, roads: [-240, -120, 0, 120, 240], roadW: 14, walkW: 4,
  ringRoads: [312],
  walk: 6, run: 10.5, jump: 7.5, grav: 22,
  taxiFare: 40, racePrize: 120, fishPrice: 15, photoBonus: 60,
  courierPay: 60, respray: 100, maxWanted: 5, heatCool: 10, hideCool: 20,
  startCash: 10350, startPos: [-240, 80],
  radio: 'CELESTE 98.1',
  tracks: ['Malecón Mirage — Vela Roja', 'Sunset Strip — The Palms', 'Neon Drive — Coral Skies', 'Midnight Marina — Vela'],
  trafficN: 36, pedN: 72, parkedN: 24, birdN: 22,
  garage: [96, -96], spray: [132, 60], restaurant: [-238, 64], pier: [-296, 44],
  beachParty: [-272, 150], raceStart: [0, -180], raceLaps: 1,
};
export const FISH = [
  { name: 'Sarden', w: 1 }, { name: 'Kakap', w: 3 },
  { name: 'Tuna Kecil', w: 5 }, { name: 'Marlin Muda', w: 9 },
];
export const PHOTO_SPOTS = [
  { name: 'Mercusuar', x: -288, z: -262 }, { name: 'Dermaga Tua', x: -296, z: 96 },
  { name: 'Plaza Spires', x: 118, z: 118 }, { name: 'Pasar Old Solara', x: -122, z: -118 },
  { name: 'Atap Docks', x: 252, z: -178 }, { name: 'Pantai Selatan', x: -272, z: 208 },
];
export const FISH_SPOTS = [
  { name: 'Ujung Dermaga', x: -298, z: 44 }, { name: 'Dermaga Kayu', x: -296, z: 88 },
];
export const RACE_CP = [[0, 40], [-258, 40], [-258, -160]];
export const COURIER_SPOTS = [[108, 108], [-240, -180], [252, 120], [-60, 240], [180, -240]];
export const CAR_TYPES = {
  sport: { name: 'VELOZ COMET RS', color: 0xff2e7e, top: 52, accel: 26, grip: 2.6, len: 4.4, wid: 2.0 },
  taxi: { name: 'TAXI SOLARA', color: 0xf5c518, top: 38, accel: 20, grip: 2.2, len: 4.4, wid: 2.0 },
  sedan: { name: 'COMETA SEDAN', color: 0x2e6fd8, top: 40, accel: 21, grip: 2.3, len: 4.5, wid: 2.0 },
  van: { name: 'MULA VAN', color: 0xe8e4d8, top: 32, accel: 15, grip: 1.9, len: 5.0, wid: 2.2 },
  truck: { name: 'HAULER', color: 0xd86a1e, top: 30, accel: 13, grip: 1.7, len: 6.2, wid: 2.4 },
  bus: { name: 'BUS SOLARA', color: 0x1e9e6a, top: 28, accel: 11, grip: 1.6, len: 8.0, wid: 2.5 },
  police: { name: 'PCPD INTERCEPTOR', color: 0x11151c, top: 48, accel: 25, grip: 2.5, len: 4.6, wid: 2.0 },
};
export const CAR_COLORS = [0xc22030, 0x2e6fd8, 0xe8e4d8, 0x1e9e6a, 0xf5c518, 0x8a5a9a, 0x3a3f4a, 0xff8fd0, 0x37e0ff];
export const CALLSIGNS = ['PELICAN-11', 'GECKO-25', 'IBIS-43', 'TARPON-19', 'HERON-17', 'KESTREL-31', 'MARLIN-26', 'BARRACUDA-18'];
export const WEAPONS = [
  { name: 'FISTS', ammo: Infinity, dmg: 25, range: 2 },
  { name: 'VESPER 72', ammo: 72, dmg: 34, range: 60 },
  { name: 'MAKO SMG', ammo: 150, dmg: 22, range: 50 },
];
// 24 parked cars: 12 original + 12 new, all on road lanes (±3.4) or open lots.
export const PARKED = [
  ['sport', -240, 66, 0.4], ['sedan', -204, -108, 1.57], ['taxi', 108, -4, 0],
  ['van', -116, 128, 3.14], ['sedan', 52, 232, 1.57], ['truck', 244, -60, 1.57],
  ['sport', 128, -232, 0], ['taxi', -8, 116, 1.57], ['van', 232, 52, 0],
  ['sedan', -232, 180, 3.14], ['taxi', 60, -100, 0], ['bus', -116, 240, 1.57],
  ['sedan', -120, -116, 0], ['taxi', 120, 116, 3.14], ['van', 0, -116, 1.57],
  ['sedan', -116, -4, 0], ['sport', 240, 116, 1.57], ['taxi', -4, -240, 0],
  ['van', 116, -116, 3.14], ['sedan', 232, -116, 0], ['truck', -120, 232, 1.57],
  ['taxi', 4, 240, 0], ['sedan', -232, -116, 3.14], ['bus', 120, 240, 1.57],
];
export const CROWDS = [
  [-258, 40, 12], [-258, -60, 8], [-128, -122, 12], [-232, 66, 8],
  [-272, 150, 12], [108, 108, 8], [252, -60, 6], [0, -180, 6], [-272, 88, 6],
];
export const SIGNS = ['TACOS', 'DONUTS', 'BAR', 'HOTEL', 'PIZZA', '24H MART', 'CEVICHE', 'CAFÉ', 'SURF', 'FLOWERS', 'TATTOO', 'GYM'];
export const NEON_BIG = [
  ['FLAMINGO FM', -258, 23], ['VICE HOTEL', -258, 130], ['TACOS 24H', -258, -150],
  ['CELESTE 98.1', 110, 128], ['MARLIN', -222, 62], ['SOLARA BAY', 60, 132],
  ['PIER 9', -292, 44], ['NEON NIGHTS', 180, 180],
];
// Missions: title, reward, next, brief {name, role, text}, steps.
// Step kinds: reach (on foot), drive (in car), talk (E), kill (guards), tail, race.
export const MISSIONS = [
  { title: 'First Gear', reward: 150, next: 'Meet Marco at Marlin Ceviche',
    brief: { name: 'Mara', role: 'MECHANIC', text: 'Nico! That pink VELOZ by the curb is yours. Take it, then bring it to my garage.' },
    steps: [
      { k: 'reach', x: -240, z: 66, r: 6, label: 'Reach the pink VELOZ' },
      { k: 'drive', x: 96, z: -96, r: 10, label: 'Drive to Mara\'s garage' },
    ] },
  { title: 'Meet Marco', reward: 200, next: 'Courier Run — 3 packages',
    brief: { name: 'Marco', role: 'SMUGGLER · WHEELMAN', text: 'Nico! Over here — Marlin Ceviche. We talk, then you drive me to the pier.' },
    steps: [
      { k: 'reach', x: -238, z: 64, r: 7, label: 'Reach Marco at Marlin Ceviche' },
      { k: 'talk', x: -238, z: 64, r: 4, label: 'Talk to Marco (E)' },
      { k: 'drive', x: -296, z: 44, r: 10, label: 'Drive Marco to the pier' },
    ] },
  { title: 'Courier Run', reward: 300, timer: 240, next: 'The Docks Job',
    brief: { name: 'Kip', role: 'DRIVER', text: 'Three packages, four minutes, no questions. First stop: the plaza.' },
    steps: [
      { k: 'drive', x: 108, z: 108, r: 8, label: 'Deliver to Plaza Spires' },
      { k: 'drive', x: 0, z: -180, r: 8, label: 'Deliver to Vista Hills' },
      { k: 'drive', x: 252, z: -60, r: 8, label: 'Deliver to The Docks' },
    ] },
  { title: 'The Docks Job', reward: 450, next: 'Neon Nights',
    brief: { name: 'Sal Vega', role: 'FIXER', text: 'Dario\'s Hauler is at the docks. Four guards. Take it, lose the heat, bring it home.' },
    steps: [
      { k: 'reach', x: 244, z: -60, r: 8, label: 'Reach Dario\'s Hauler' },
      { k: 'kill', x: 244, z: -60, r: 40, n: 4, label: 'Take out 4 guards' },
      { k: 'drive', x: 96, z: -96, r: 10, label: 'Drive the Hauler to the garage' },
    ],
    guards: [[236, -68], [252, -52], [240, -44], [256, -72]], wantedOnDrive: 2 },
  { title: 'Neon Nights', reward: 500, night: 21.0, next: 'Street Race',
    brief: { name: 'Kip', role: 'DRIVER', text: 'Night run. Tail Dario\'s courier — close enough to see, far enough to stay invisible.' },
    steps: [
      { k: 'tail', x: 240, z: 120, r: 40, label: 'Tail the courier (stay 8–40 m)' },
      { k: 'drive', x: 96, z: -96, r: 10, label: 'Lose the tail, drive to the garage' },
    ] },
  { title: 'Street Race', reward: 120, next: 'Beach Party',
    brief: { name: 'Lupe', role: 'RACER', text: 'Midnight money on the boulevard, Nico. Beat my two boys to the pier and the $120 is yours.' },
    steps: [
      { k: 'reach', x: 0, z: -180, r: 10, label: 'Reach the start line' },
      { k: 'race', x: 0, z: 40, r: 10, label: 'Race to the pier — beat 2 rivals' },
    ] },
  { title: 'Beach Party', reward: 250, next: 'Golden Hour',
    brief: { name: 'Lupe', role: 'RACER', text: 'Party on the beach, Nico! Come say hi, then drive me up the Malecón.' },
    steps: [
      { k: 'reach', x: -272, z: 150, r: 10, label: 'Reach the beach party' },
      { k: 'talk', x: -272, z: 150, r: 4, label: 'Talk to Lupe (E)' },
      { k: 'drive', x: -258, z: -40, r: 10, label: 'Drive Lupe up the Malecón' },
    ] },
  { title: 'Golden Hour', reward: 800, timer: 107, next: 'Solara Bay is yours',
    brief: { name: 'Marco', role: '', text: 'The boat sails in two minutes, Nico! Shake that chopper and get to the pier!' },
    steps: [
      { k: 'drive', x: -296, z: 44, r: 10, label: 'Reach the pier before the boat sails' },
    ],
    wantedOnStart: 4 },
];
export function districtAt(x, z) {
  if (x < -235) return 'Malecón Celeste';
  if (x > 235) return 'The Docks';
  if (x > 60 && z > 60) return 'Plaza Spires';
  if (x < -60 && z < -60) return 'Old Solara';
  if (z < -140) return 'Vista Hills';
  if (x < -60 && z > 60) return 'Marina Bay';
  return 'Calle Verde';
}
