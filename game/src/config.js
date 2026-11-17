// SOLARA BAY — tuning constants. One place for speeds, prices, wanted rules.
export const CFG = {
  cityHalf: 300,
  roadGap: 60,
  roadWidth: 12,
  walkSpeed: 6,
  runSpeed: 10.5,
  jumpSpeed: 8,
  gravity: 22,
  dayLengthSec: 480,
  startHour: 10,
  resprayPerStar: 100,
  pistolPrice: 250,
  armorPrice: 150,
  maxHealth: 100,
  maxArmor: 100,
  maxWanted: 5,
  heatHideSec: 10,
  heatClearSec: 20,
  trafficCount: 14,
  pedCount: 24,
  sunCoinCount: 30,
  garageSlots: 3,
  saveKey: 'solarabay-save-v1',
  carTypes: {
    sedan: { name: 'Cometa', color: 0x3a6fd8, top: 34, accel: 15, grip: 2.6, hp: 100, len: 4.4 },
    hatch: { name: 'Pip', color: 0xe8b13c, top: 28, accel: 13, grip: 2.9, hp: 80, len: 3.6 },
    taxi: { name: 'Cabro', color: 0xf2c200, top: 30, accel: 14, grip: 2.6, hp: 90, len: 4.4 },
    van: { name: 'Mula', color: 0x7a7f85, top: 25, accel: 10, grip: 2.2, hp: 140, len: 5.0 },
    sport: { name: 'Veloce GT', color: 0xd82828, top: 47, accel: 21, grip: 3.3, hp: 90, len: 4.2 },
    truck: { name: 'Hauler', color: 0x2e7d4f, top: 22, accel: 8, grip: 2.0, hp: 170, len: 6.0 },
  },
  districts: [
    { name: 'Marina Bay', x0: -300, z0: -300, x1: -120, z1: 300, minH: 6, maxH: 16, tint: 0xead9b0 },
    { name: 'Old Solara', x0: -120, z0: -120, x1: 60, z1: 120, minH: 8, maxH: 20, tint: 0xe8a56b },
    { name: 'The Spires', x0: 60, z0: -180, x1: 240, z1: 60, minH: 30, maxH: 70, tint: 0x9fc4d8 },
    { name: 'The Docks', x0: 60, z0: 60, x1: 300, z1: 300, minH: 8, maxH: 18, tint: 0x8f9aa3 },
    { name: 'Vista Hills', x0: -120, z0: -300, x1: 300, z1: -180, minH: 10, maxH: 26, tint: 0xc9d6a8 },
    { name: 'Calle Verde', x0: -300, z0: 120, x1: -120, z1: 300, minH: 6, maxH: 14, tint: 0xa8d6a0 },
  ],
};

export function districtAt(x, z) {
  for (const d of CFG.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return CFG.districts[1];
}
