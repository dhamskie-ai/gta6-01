// RNG seeded (mulberry32) — kota & spawn identik tiap load dgn seed sama.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function range(r, a, b) { return a + r() * (b - a); }
export function rangeInt(r, a, b) { return Math.floor(range(r, a, b + 1)); }
export function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
export function chance(r, p) { return r() < p; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz;
}
export function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function fmtTimer(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
