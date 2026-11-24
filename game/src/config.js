// SOLARA BAY tuning: speeds, prices, wanted rules, clock, districts, cars.
export const CONFIG = {
  worldSize: 640,
  halfWorld: 320,
  walkSpeed: 6,
  runSpeed: 10.5,
  jumpSpeed: 7.5,
  gravity: 20,
  carEnterRange: 4,
  stealHeat: 1,
  resprayPerStar: 100,
  hideSeconds: 10,
  clearSeconds: 20,
  dayLengthSec: 480,
  startHour: 8,
  sunCoins: 30,
  garageSlots: 3,
  trafficCount: 36,
  parkedCount: 24,
  pedCount: 150,
  birdCount: 22,
  buildingCount: 120,
  treeCount: 200,
};

export const DISTRICTS = [
  { name: 'Marina Bay', x: -260, z: 0, style: 'beach' },
  { name: 'Old Solara', x: -120, z: -120, style: 'market' },
  { name: 'The Spires', x: 80, z: -80, style: 'tower' },
  { name: 'The Docks', x: 200, z: 160, style: 'dock' },
  { name: 'Vista Hills', x: 160, z: -220, style: 'villa' },
  { name: 'Calle Verde', x: -40, z: 200, style: 'residential' },
];

// 6 procedural car models: top speed (m/s), acceleration, turn rate.
export const CAR_TYPES = {
  sedan: { name: 'Cometa', topSpeed: 34, accel: 14, turn: 1.9, color: 0x3f7fd0 },
  hatch: { name: 'Pip', topSpeed: 30, accel: 13, turn: 2.2, color: 0xe2543e },
  taxi: { name: 'Cabro', topSpeed: 32, accel: 13, turn: 2.0, color: 0xffd23f },
  van: { name: 'Mula', topSpeed: 26, accel: 10, turn: 1.5, color: 0x9aa5b1 },
  sport: { name: 'Veloce GT', topSpeed: 46, accel: 20, turn: 2.4, color: 0xd81e5b },
  truck: { name: 'Hauler', topSpeed: 24, accel: 9, turn: 1.3, color: 0x4a6b4f },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 2.2, rate: 0.45, ammo: Infinity },
  pistol: { name: 'Vesper Pistol', damage: 34, range: 42, rate: 0.28, ammo: 12, mag: 12 },
};

export const PRICES = { resprayPerStar: 100, pistol: 250, armor: 150, ammo: 40 };
export const SAVE_KEY = 'solara-bay-save-v1';
