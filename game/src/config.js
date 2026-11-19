// Tuning, districts, cars, weapons, radio — everything the systems read.
export const CONFIG = {
  world: 640, half: 320, roadGap: 120, roadW: 14,
  trafficCount: 20, pedCount: 36, parkedCount: 16, sunCoins: 30,
  walkSpeed: 6, runSpeed: 10, jumpV: 8, gravity: 22,
  wantedDecaySeen: 10, wantedDecayHidden: 20, resprayPerStar: 100,
  dayLength: 480, // seconds of play per full 24h cycle
  districts: [
    { name: 'Malecón Celeste', x0: -320, x1: -180, z0: -320, z1: 320, tall: 0 },
    { name: 'Marina Bay', x0: -180, x1: -60, z0: -320, z1: -40, tall: 0 },
    { name: 'The Spires', x0: -60, x1: 180, z0: -320, z1: -40, tall: 1 },
    { name: 'The Docks', x0: 180, x1: 320, z0: -320, z1: 40, tall: 0 },
    { name: 'Old Solara', x0: -180, x1: 180, z0: -40, z1: 200, tall: 0 },
    { name: 'Vista Hills', x0: 180, x1: 320, z0: 40, z1: 320, tall: 0 },
    { name: 'Coral Strand', x0: -180, x1: 180, z0: 200, z1: 320, tall: 0 },
    { name: 'Calle Verde', x0: -60, x1: 180, z0: 40, z1: 200, tall: 0 },
  ],
  cars: {
    sedan: { name: 'Cometa', color: 0x3d7ac2, top: 32, accel: 14, turn: 1.9 },
    hatch: { name: 'Pip', color: 0xe8a13a, top: 28, accel: 13, turn: 2.1 },
    taxi: { name: 'Cabro', color: 0xf2c200, top: 30, accel: 13, turn: 2.0 },
    van: { name: 'Mula', color: 0x8a8f98, top: 25, accel: 10, turn: 1.6 },
    sport: { name: 'Veloz Comet RS', color: 0xff2e7e, top: 46, accel: 20, turn: 2.4 },
    truck: { name: 'Hauler', color: 0x4a6b4f, top: 24, accel: 9, turn: 1.4 },
    bus: { name: 'Solara Bus', color: 0x2a9d8f, top: 22, accel: 8, turn: 1.3 },
    taco: { name: 'Taco Truck', color: 0xe85d3d, top: 23, accel: 9, turn: 1.5 },
    police: { name: 'PCPD Interceptor', color: 0x1c2733, top: 38, accel: 17, turn: 2.2 },
  },
  weapons: [
    { id: 'fists', name: 'FISTS', ammo: Infinity, max: Infinity, dmg: 20, rate: 0.45, auto: false, price: 0 },
    { id: 'vesper', name: 'VESPER', ammo: 72, max: 72, dmg: 25, rate: 0.28, auto: false, price: 0 },
    { id: 'mako', name: 'MAKO', ammo: 150, max: 150, dmg: 16, rate: 0.09, auto: true, price: 1200 },
    { id: 'breaker', name: 'BREAKER', ammo: 0, max: 24, dmg: 70, rate: 0.9, auto: false, price: 3800 },
    { id: 'kestrel', name: 'KESTREL', ammo: 0, max: 40, dmg: 55, rate: 0.5, auto: false, price: 0, locked: true },
  ],
  radio: { station: 'CELESTE 98.1', tracks: ['Malecón Mirage · Vela Roja', 'Midnight Marina · Vela', 'Sunset Strip · The Palms', 'Neon Drive · Coral Skies'] },
  policeNames: ['PELICAN-11', 'GECKO-25', 'AIR-1', 'BARRACUDA-18', 'TAC-45', 'IBIS-43', 'TARPON-19', 'HERON-17', 'KESTREL-31'],
  respectTitles: [[0, 'ROOKIE'], [100, 'HUSTLER'], [250, 'SHOT CALLER'], [550, 'KINGPIN']],
  garage: { x: -60, z: -30 },
  gunShop: { x: 60, z: 120 },
  sprayShop: { x: -120, z: 60 },
  pier: { x: -288, z: 150 },
  marlin: { x: -240, z: 90 },
  ferris: { x: -252, z: -90 },
  lighthouse: { x: -292, z: -210 },
};
export function districtAt(x, z) {
  for (const d of CONFIG.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  return 'Solara Bay';
}
export function respectTitle(xp) {
  let t = 'ROOKIE';
  for (const [min, name] of CONFIG.respectTitles) if (xp >= min) t = name;
  const next = CONFIG.respectTitles.find(([min]) => min > xp);
  return { title: t, next: next ? next[0] : xp };
}
export const fmtCash = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(1, '0') + ':' + String(s % 60).padStart(2, '0'); };
