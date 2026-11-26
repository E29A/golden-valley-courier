// A small seeded random number generator (mulberry32): the same seed gives the
// same valley, the same rings and the same screenshots, every run.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise in 2D, built from the seeded generator: a grid of random
// gradients hashed by cell, interpolated with a smoothstep curve.
export function makeNoise2D(seed) {
  const rand = createRandom(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const grad = (h, x, y) => {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  };
  return function noise(x, y) {
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const u = fade(xf); const v = fade(yf);
    const aa = perm[(perm[xi & 255] + yi) & 255];
    const ab = perm[(perm[xi & 255] + yi + 1) & 255];
    const ba = perm[(perm[(xi + 1) & 255] + yi) & 255];
    const bb = perm[(perm[(xi + 1) & 255] + yi + 1) & 255];
    const x1 = grad(aa, xf, yf) + (grad(ba, xf - 1, yf) - grad(aa, xf, yf)) * u;
    const x2 = grad(ab, xf, yf - 1) + (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1)) * u;
    return (x1 + (x2 - x1) * v) * 0.7071;
  };
}

// Fractal Brownian motion: several octaves of value noise, for hills and valleys.
export function fbm(noise, x, y, octaves) {
  let value = 0; let amp = 0.5; let freq = 1; let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += amp * noise(x * freq, y * freq);
    total += amp; amp *= 0.5; freq *= 2.03;
  }
  return value / total;
}
