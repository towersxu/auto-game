/**
 * SeedSystem Module
 *
 * Deterministic random number generator based on a seed string.
 * All game logic that requires randomness MUST use this system
 * instead of calling Math.random() directly.
 *
 * Uses the mulberry32 algorithm for fast, reproducible 32-bit PRNG.
 */

/**
 * Hash a string into a 32-bit unsigned integer using a simple
 * variant of the DJB2 / xorshift hash.
 */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h = h | 0; // convert to 32-bit integer
  }
  return h >>> 0; // unsigned
}

/**
 * Mulberry32 — a fast, high-quality 32-bit PRNG.
 * Returns a function that produces a new float in [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A deterministic random number generator seeded by a string.
 *
 * Given the same seed, the sequence of generated numbers is always
 * identical, making game behaviour fully reproducible.
 *
 * @example
 * ```ts
 * const rng = new SeedSystem('my-seed');
 * rng.nextInt(1, 6);   // always the same for "my-seed"
 * rng.choice(['a', 'b', 'c']);
 * ```
 */
export class SeedSystem {
  public readonly seed: string;
  private readonly _next: () => number;

  constructor(seed: string) {
    this.seed = seed;
    this._next = mulberry32(hashSeed(seed));
  }

  /**
   * Generate a random floating-point number in [0, 1).
   */
  nextFloat(): number {
    return this._next();
  }

  /**
   * Generate a random integer in the closed interval [min, max].
   *
   * @param min - Lower bound (inclusive).
   * @param max - Upper bound (inclusive).
   */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this._next() * (max - min + 1));
  }

  /**
   * Randomly pick one element from a non-empty list.
   *
   * @throws {Error} If the list is empty.
   */
  choice<T>(list: readonly T[]): T {
    if (list.length === 0) {
      throw new Error('Cannot choose from an empty list');
    }
    return list[this.nextInt(0, list.length - 1)];
  }
}
