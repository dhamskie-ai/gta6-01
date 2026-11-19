// Tuning SOLARA BAY (ronde 6g). Semua angka gameplay di satu tempat.
export const CFG = {
  seed: 1,
  mapHalf: 320, // peta 640 x 640 m, pantai di barat (x negatif)
  // Pemain jalan kaki
  walkSpeed: 4.2, runSpeed: 7.5, jumpSpeed: 7.5, gravity: 20,
  playerRadius: 0.55,
  // Mobil (arcade)
  carAccel: 16, carBrake: 30, carReverse: 9, carMax: 38, carDrag: 0.35,
  carTurn: 1.9, carGrip: 6,
  // Waktu: 1 jam game = 75 detik nyata; mulai 10:00
  hourLength: 75, startHour: 10,
  // Wanted / PCPD
  wantedDecaySeen: 10, wantedDecayHidden: 20, resprayPerStar: 100,
  // Ekonomi
  startCash: 250, taxiFare: 120, sunCoinValue: 50, stuntBonus: 200,
  // Senjata: [nama, harga, peluru/mag, damage, fireRate]
  weapons: [
    { name: 'FISTS', price: 0, mag: Infinity, dmg: 12, rate: 0.45, auto: false },
    { name: 'VESPER 72', price: 0, mag: 12, dmg: 22, rate: 0.22, auto: false },
    { name: 'MAKO 150', price: 800, mag: 30, dmg: 14, rate: 0.09, auto: true },
    { name: 'BREAKER', price: 3800, mag: 6, dmg: 65, rate: 0.8, auto: false },
    { name: 'KESTREL', price: 0, mag: 8, dmg: 90, rate: 1.1, auto: false, locked: true },
  ],
  // Dunia
  trafficCars: 14, peds: 36, birds: 14, sunCoins: 30,
  spawn: { x: 24, z: 96, heading: -2.78 },
  // Warna langit per jam (dipakai render.js): [jam, atas, horizon, kabut]
  skyStops: [
    [0, 0x0a1030, 0x1c2a55, 0x0d1526], [5, 0x1a2450, 0x7a5a8a, 0x2a2440],
    [7, 0x5a8fd0, 0xffc98a, 0xc9a06a], [10, 0x3f8fd8, 0xbfe6f5, 0x8fc3e8],
    [15, 0x3a8ad8, 0xcfeef8, 0x9fd0ea], [17.5, 0x6a5ac0, 0xff9d5c, 0xe8a06a],
    [18.8, 0x8a4a9a, 0xff7e5e, 0xd86a6a], [20, 0x141c44, 0x3a2a5e, 0x1a2038],
    [22, 0x070d24, 0x141c3c, 0x0b1020],
  ],
  radioTracks: [
    'Malecón Mirage · Vela Roja', 'Sunset Static · Los Cometas',
    'Palm Static · DJ Lupe', 'Golden Hour · Nico Vega',
    'Neon Palms · Marlin Sound', 'Celeste Nights · La Ola',
  ],
  pcpdUnits: ['PELICAN-11', 'GECKO-25', 'AIR-1', 'BARRACUDA-18', 'TAC-45',
    'VIPER-07', 'SHARK-33', 'ORCA-52', 'FALCON-09', 'COBRA-21'],
  pedNames: ['Ana', 'Beto', 'Carla', 'Dio', 'Elena', 'Felix', 'Gita', 'Hugo',
    'Ira', 'Jo', 'Kiki', 'Leo', 'Mia', 'Nia', 'Omar', 'Pia', 'Riko', 'Sari'],
};
// Spesifikasi tiap model mobil: [nama, warna, topSpeed, accel, handling, harga]
export const CAR_KINDS = {
  cometa: { name: 'COMETA', color: 0x3a7bd5, top: 30, accel: 13, turn: 1.7 },
  pip: { name: 'PIP', color: 0xe8b93e, top: 26, accel: 12, turn: 2.1 },
  cabro: { name: 'CABRO TAXI', color: 0xf2c200, top: 29, accel: 12, turn: 1.8 },
  mula: { name: 'MULA VAN', color: 0x8a94a6, top: 24, accel: 10, turn: 1.4 },
  veloz: { name: 'VELOZ COMET RS', color: 0xd21f2b, top: 42, accel: 19, turn: 2.2 },
  hauler: { name: 'HAULER', color: 0x4a6b4f, top: 22, accel: 9, turn: 1.2 },
  pcpd: { name: 'PCPD INTERCEPTOR', color: 0x1a2a4a, top: 36, accel: 17, turn: 2.0 },
  bus: { name: 'BUS SOLARA', color: 0x2a9d8f, top: 22, accel: 8, turn: 1.1 },
  taco: { name: 'TACO TRUCK', color: 0xff8c42, top: 20, accel: 8, turn: 1.2 },
};
