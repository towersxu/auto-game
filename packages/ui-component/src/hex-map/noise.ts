/**
 * Seeded 2-D Value Noise with multiple octaves (fractal Brownian motion).
 *
 * This is a pure-TypeScript implementation with no external dependencies.
 * It uses a hash-based gradient that produces smooth, Perlin-like output in
 * the range [0, 1].
 */

/** Simple 32-bit integer hash of (x, y, seed). */
function hash(x: number, y: number, seed: number): number {
  // Combine the three integers using prime multiplications then bit-mix.
  let h = (seed ^ (x * 1619)) ^ (y * 31337);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  // Map to [0, 1] using the unsigned 32-bit range.
  return (h >>> 0) / 0xffffffff;
}

/** Quintic smoothstep: 6t⁵ − 15t⁴ + 10t³ */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Single-octave 2-D value noise at (x, y) with the given seed.
 * Returns a value in [0, 1].
 */
function valueNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = fade(xf);
  const v = fade(yf);

  const a = hash(xi,     yi,     seed);
  const b = hash(xi + 1, yi,     seed);
  const c = hash(xi,     yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);

  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/**
 * Fractal Brownian Motion (fBm) noise: sum of multiple octaves.
 *
 * @param x        - World x coordinate.
 * @param y        - World y coordinate (maps to z in 3-D world).
 * @param seed     - Integer seed for reproducibility.
 * @param octaves  - Number of frequency layers (default 6).
 * @param scale    - Base frequency scale (smaller = larger features, default 0.05).
 * @returns        Value in [0, 1].
 */
export function octaveNoise(
  x: number,
  y: number,
  seed: number,
  octaves = 6,
  scale = 0.05,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += valueNoise2D(x * frequency, y * frequency, seed + i * 1000) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue; // Normalized to [0, 1]
}
