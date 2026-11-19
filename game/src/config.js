// SOLARA BAY — tuning & data tables. All names, places and prices are
// original fiction for this game; no real-world brands are referenced.
export const CFG = {
  seed: 1,
  worldHalf: 300,
  roads: [-240, -120, 0, 120, 240],
  roadWidth: 10,
  sidewalk: 3.5,
  coastX: -240,
  seaX: -258,
  beachX0: -258,
  beachX1: -246,
  marlinCeviche: { x: -240, z: 90 },
  marcoPos: { x: -240, z: 87 },
  pier: { x: -268, z: 90 },
  lighthouse: { x: -256, z: -252 },
  garage: { x: -116, z: -116 },
  sprayShop: { x: 116, z: 116 },
  gunShop: { x: 120, z: -116 },
  taxiStand: { x: 4, z: 116 },
  playerStart: { x: -232, z: 64 },
  trafficCount: 20,
  pedCount: 36,
  birdCount: 14,
  parkedCount: 16,
  walkSpeed: 5.2,
  runSpeed: 9.5,
  jumpSpeed: 7.5,
  gravity: 20,
  dayStart: 17.0,
  sunCoinCount: 30,
  resprayPerStar: 100,
  wantedDecayUnseen: 10,
  wantedClearTime: 20,
  radioStation: 'CELESTE 98.1',
};

export const CAR_DEFS = {
  cometa: { name: 'COMETA', kind: 'sedan', maxSpeed: 34, accel: 11, brake: 26, turn: 1.9, color: 0x3f6fb5, len: 4.4, wid: 1.9 },
  pip: { name: 'PIP', kind: 'hatch', maxSpeed: 30, accel: 10, brake: 24, turn: 2.2, color: 0xe8b93a, len: 3.8, wid: 1.8 },
  cabro: { name: 'CABRO TAXI', kind: 'taxi', maxSpeed: 32, accel: 10.5, brake: 25, turn: 2.0, color: 0xf2c200, len: 4.4, wid: 1.9 },
  mula: { name: 'MULA', kind: 'van', maxSpeed: 27, accel: 8, brake: 20, turn: 1.6, color: 0x7a7f8a, len: 5.0, wid: 2.0 },
  veloce: { name: 'VELOZ COMET RS', kind: 'sport', maxSpeed: 48, accel: 15, brake: 30, turn: 2.4, color: 0xff2e7e, len: 4.5, wid: 2.0 },
  hauler: { name: 'HAULER', kind: 'truck', maxSpeed: 25, accel: 7, brake: 18, turn: 1.3, color: 0x4a7d4f, len: 6.2, wid: 2.2 },
  bus: { name: 'SOLARA TRANSIT', kind: 'bus', maxSpeed: 24, accel: 6, brake: 16, turn: 1.2, color: 0x2e8fa3, len: 8.0, wid: 2.4 },
  taco: { name: 'TACO TRUCK', kind: 'truck', maxSpeed: 26, accel: 7.5, brake: 19, turn: 1.4, color: 0xe86a1e, len: 5.2, wid: 2.1 },
  police: { name: 'PCPD INTERCEPTOR', kind: 'sedan', maxSpeed: 40, accel: 13, brake: 28, turn: 2.1, color: 0x14181f, len: 4.5, wid: 1.95 },
};

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', ammo: Infinity, price: 0, locked: false },
  { id: 'vesper', name: 'VESPER', ammo: 72, price: 0, locked: false },
  { id: 'mako', name: 'MAKO', ammo: 150, price: 0, locked: false },
  { id: 'breaker', name: 'BREAKER', ammo: 0, price: 3800, locked: false },
  { id: 'kestrel', name: 'KESTREL', ammo: 0, price: 0, locked: true },
];

export const POLICE_CALLSIGNS = [
  'PELICAN-11', 'GECKO-25', 'AIR-1', 'BARRACUDA-18', 'TAC-45',
  'IBIS-43', 'TARPON-19', 'HERON-17', 'KESTREL-31', 'MARLIN-26', 'OSPREY-08',
];

export const RADIO_TRACKS = [
  'Malecón Mirage — Vela Roja',
  'Midnight Marina — Vela',
  'Sunset Strip — The Palms',
  'Neon Drive — Coral Skies',
];

export const SHOP_SIGNS = [
  { text: 'TACOS', fg: '#ffd23f', bg: '#c22e2e' },
  { text: 'DONUTS', fg: '#ffffff', bg: '#e86aa8' },
  { text: 'BAR', fg: '#ffe9a8', bg: '#22303f' },
  { text: 'HOTEL', fg: '#8ef2ff', bg: '#14324a' },
  { text: 'PIZZA', fg: '#fff3c4', bg: '#a33327' },
  { text: '24H MART', fg: '#c9ffd6', bg: '#1f6b3a' },
  { text: 'MARLIN CEVICHE', fg: '#ffe9a8', bg: '#0e5a6b' },
  { text: 'CELESTE 98.1', fg: '#ffd6f2', bg: '#7a1e6e' },
];

export const NEON_SIGNS = [
  { text: 'SOLARA BAY', color: '#ffb347', x: 0, z: -118, face: 'S' },
  { text: 'MARLIN CEVICHE', color: '#7de3ff', x: -226, z: 96, face: 'E' },
  { text: 'CELESTE 98.1', color: '#ff8fd6', x: -226, z: 150, face: 'E' },
  { text: 'SPRAY & SHINE', color: '#8dff9e', x: 118, z: 118, face: 'S' },
  { text: 'TACOS 24H', color: '#ffd23f', x: 118, z: -118, face: 'S' },
  { text: 'CAL’S GUNS', color: '#ff9d5c', x: 118, z: -118, face: 'N' },
  { text: 'VICE HOTEL', color: '#37e0ff', x: -226, z: -30, face: 'E' },
  { text: 'FLAMINGO FM', color: '#ff5fa2', x: -226, z: 30, face: 'E' },
];

export const PED_NAMES = [
  'Ana', 'Beto', 'Celia', 'Dimas', 'Elena', 'Faris', 'Gita', 'Hugo',
  'Ines', 'Joko', 'Kira', 'Leo', 'Mira', 'Nando', 'Ola', 'Paco',
  'Rosa', 'Sari', 'Tono', 'Uma', 'Vera', 'Wira', 'Yara', 'Zaki',
];

export const SAVE_KEY = 'solarabay-save-v1';
