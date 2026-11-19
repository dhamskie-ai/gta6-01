// RNG seeded (mulberry32) — kota, traffic, dan pejalan kaki identik tiap
// load dengan seed yang sama (?seed=, default 1).
export function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rr(r, a, b) { return a + r() * (b - a); }
export function ri(r, a, b) { return Math.floor(rr(r, a, b + 1)); }
export function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
export function chance(r, p) { return r() < p; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
