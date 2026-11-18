// SOLARA BAY tuning: speeds, prices, wanted rules, clock, city size.
export const CONFIG = {
  cityHalf: 300, streetStep: 60, streetMin: -240, streetMax: 240, roadHalf: 5,
  walkSpeed: 4.2, runSpeed: 7.5, jumpSpeed: 7.5, gravity: 20,
  carAccel: 16, carBrake: 30, carReverseMax: 12, carDrag: 0.6,
  trafficCount: 14, pedCount: 24, parkedCount: 12,
  wantedDecayHidden: 10, wantedClearHidden: 20, resprayPerStar: 100,
  pistolPrice: 250, armorPrice: 150, taxiFare: 60, jumpReward: 80, coinValue: 25,
  dayLength: 480, // seconds per full 24h cycle
  maxWanted: 5,
};

export const CAR_MODELS = {
  sedan:   { name: 'Cometa',    top: 34, accel: 1.0, grip: 1.0, color: 0x3f6fb5, len: 4.4, wid: 1.9 },
  hatch:   { name: 'Pip',       top: 30, accel: 0.95, grip: 1.1, color: 0xd94f3d, len: 3.8, wid: 1.8 },
  taxi:    { name: 'Cabro',     top: 32, accel: 1.0, grip: 1.0, color: 0xf2c200, len: 4.4, wid: 1.9 },
  van:     { name: 'Mula',      top: 26, accel: 0.8, grip: 0.9, color: 0x7a7f85, len: 5.0, wid: 2.1 },
  sport:   { name: 'Veloce GT', top: 46, accel: 1.35, grip: 1.25, color: 0xc22030, len: 4.5, wid: 2.0 },
  truck:   { name: 'Hauler',    top: 24, accel: 0.7, grip: 0.85, color: 0x2e7d5b, len: 6.2, wid: 2.3 },
};

export const DISTRICTS = [
  { name: 'Marina Bay',  test: (x, z) => x < -180, style: 'marina' },
  { name: 'The Docks',   test: (x, z) => x > 180, style: 'docks' },
  { name: 'Vista Hills', test: (x, z) => z < -180, style: 'hills' },
  { name: 'The Spires',  test: (x, z) => Math.abs(x) <= 120 && Math.abs(z) <= 120, style: 'spires' },
  { name: 'Old Solara',  test: (x, z) => z > 60 && Math.abs(x) <= 180, style: 'oldsolara' },
  { name: 'Calle Verde', test: () => true, style: 'verde' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d;
  return DISTRICTS[DISTRICTS.length - 1];
}

export const MISSIONS = [
  { id: 1, name: 'First Gear', reward: 150, briefing: 'Sal Vega: Ro, you owe me. Start simple — steal that parked Cometa and bring it to Mara at the garage. Keep it clean.',
    steps: [
      { text: 'Steal the parked car (press E near it)', kind: 'steal', pos: [2.5, 36] },
      { text: 'Drive to Mara\'s Garage', kind: 'goto', pos: [-60, -30], radius: 10 },
    ] },
  { id: 2, name: 'Courier Run', reward: 250, time: 240, briefing: 'Kip: Three parcels, four minutes. Sal\'s clients don\'t wait. Don\'t smash the goods.',
    steps: [
      { text: 'Deliver parcel 1 — Calle Verde', kind: 'goto', pos: [-150, 120], radius: 9 },
      { text: 'Deliver parcel 2 — The Docks', kind: 'goto', pos: [210, 0], radius: 9 },
      { text: 'Deliver parcel 3 — Vista Hills', kind: 'goto', pos: [90, -180], radius: 9 },
    ] },
  { id: 3, name: 'The Docks Job', reward: 400, briefing: 'Sal Vega: Kane\'s crew guards a Hauler full of his imports at the Docks. Take it. Expect trouble.',
    steps: [
      { text: 'Reach the Docks yard', kind: 'goto', pos: [210, 90], radius: 12 },
      { text: 'Deal with the 4 guards', kind: 'clear', pos: [210, 90], count: 4 },
      { text: 'Steal the Hauler and drive it to the garage', kind: 'stealTruck', pos: [222, 96] },
      { text: 'Deliver the Hauler to Mara\'s Garage', kind: 'goto', pos: [-60, -30], radius: 10 },
    ] },
  { id: 4, name: 'Neon Nights', reward: 500, briefing: 'Kip: Kane\'s courier leaves the Marina at night. Tail him — stay back, don\'t spook him. When he runs, chase him down.',
    steps: [
      { text: 'Wait for the courier near the pier (night)', kind: 'wait', pos: [-240, 30], radius: 14 },
      { text: 'Tail the courier — stay within 40 m, don\'t get closer than 12 m', kind: 'tail', pos: [-180, 60], radius: 40 },
      { text: 'Chase the courier down — ram his car to stop it', kind: 'chase', pos: [-120, 120], radius: 30 },
    ] },
  { id: 5, name: 'Bay Heist', reward: 1000, briefing: 'Sal Vega: The finale, Ro. Kane\'s show car — a Veloce GT Aurelia — sits in the Spires penthouse garage. Take it to the pier. This ends the debt.',
    steps: [
      { text: 'Reach the Spires penthouse garage', kind: 'goto', pos: [30, 0], radius: 10 },
      { text: 'Steal the Veloce GT Aurelia', kind: 'steal', pos: [36, 0] },
      { text: 'Escape the 4-star chase to the Marina pier', kind: 'escape', pos: [-240, 0], radius: 14 },
    ] },
  { id: 6, name: 'Harbor Lights', reward: 600, briefing: 'Sal Vega: The debt is settled, Ro — but Kane\'s final shipment is still parked at the harbor, lights blazing and no one guarding it. Mara wants the manifest from that Hauler, and Kip has already lined up a buyer. One last job, then the bay is truly yours.',
    steps: [
      { text: 'Reach the harbor pier at dusk', kind: 'goto', pos: [210, 30], radius: 12 },
      { text: 'Clear Kane\'s last guards at the pier', kind: 'clear', pos: [216, 36], count: 3 },
      { text: 'Steal the Hauler with the harbor manifest', kind: 'stealTruck', pos: [222, 36] },
      { text: 'Deliver the Hauler to Mara\'s Garage', kind: 'goto', pos: [-60, -30], radius: 10 },
    ] },
];

export const TAXI_SPOTS = [[-150, 120], [150, -120], [30, 120], [-150, -60], [90, 60]];
export const JUMP_RAMPS = [[-60, 0], [120, 60], [0, -180]];
export const SHOP_POS = { guns: [60, 120], spray: [-60, 30], garage: [-60, -30] };
export const PED_NAMES = ['Ana', 'Beto', 'Cleo', 'Dario', 'Elsa', 'Finn', 'Gia', 'Hugo', 'Ines', 'Joel', 'Lena', 'Marco', 'Nia', 'Omar', 'Pia', 'Rosa', 'Tomas', 'Uma', 'Vic', 'Wren'];
