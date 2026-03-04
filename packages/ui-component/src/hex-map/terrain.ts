/**
 * Terrain module – maps noise values to elevation tiers and colours.
 *
 * Elevation tiers (based on normalized noise value 0–1):
 *   SUBMERGED  : < 0.30  – water (deep blue → light blue)
 *   BASELAND   : 0.30–0.50 – flat ground (dark green → light green)
 *   ELEVATED   : 0.50–0.72 – hills (olive → sandy brown)
 *   PEAK       : > 0.72  – mountains (slate grey → snow white)
 */

/** Four discrete elevation tiers. */
export const enum ElevationTier {
  SUBMERGED = 0,
  BASELAND  = 1,
  ELEVATED  = 2,
  PEAK      = 3,
}

/** Visual height (world-unit Y-level of the top face) per tier boundary. */
export const TIER_THRESHOLDS = [0.30, 0.50, 0.72] as const;

/** Base world height at the top of each prism (Y axis), scaled from noise. */
export function noiseToWorldHeight(noiseValue: number): number {
  // Map [0,1] to roughly [-0.4, 2.0] – submerged tiles are below 0.
  return (noiseValue - 0.30) * 3.0;
}

/** Determine the elevation tier from a raw noise value (0–1). */
export function getElevationTier(noiseValue: number): ElevationTier {
  if (noiseValue < TIER_THRESHOLDS[0]) return ElevationTier.SUBMERGED;
  if (noiseValue < TIER_THRESHOLDS[1]) return ElevationTier.BASELAND;
  if (noiseValue < TIER_THRESHOLDS[2]) return ElevationTier.ELEVATED;
  return ElevationTier.PEAK;
}

/**
 * Colour lookup tables for each tier.
 * Each entry is [low-colour, high-colour] as 0xRRGGBB integers.
 * The noise value within the tier's range interpolates between the two.
 */
const TIER_COLOUR_RANGE: Readonly<Record<ElevationTier, [number, number]>> = {
  [ElevationTier.SUBMERGED]: [0x1a3f7a, 0x3a9ad9],  // deep blue → sky blue
  [ElevationTier.BASELAND]:  [0x2d6a2d, 0x52c45a],  // forest green → meadow green
  [ElevationTier.ELEVATED]:  [0x7a6030, 0xb5995a],  // dark earth → sandy
  [ElevationTier.PEAK]:      [0x8a8a90, 0xf0f0f8],  // granite → snow
};

/** Normalised position of `value` within [lo, hi]. */
function normalise(value: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
}

/** Linear interpolate each RGB channel between two hex colours. */
export function lerpColor(colorA: number, colorB: number, t: number): number {
  const ar = (colorA >> 16) & 0xff;
  const ag = (colorA >> 8) & 0xff;
  const ab = colorA & 0xff;
  const br = (colorB >> 16) & 0xff;
  const bg = (colorB >> 8) & 0xff;
  const bb = colorB & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Return the 0xRRGGBB terrain colour for a given noise value.
 * The colour is interpolated within the tier's colour range.
 * An optional `jitter` value (0–1) adds per-cell hue variation.
 */
export function terrainColor(noiseValue: number, jitter = 0): number {
  const tier = getElevationTier(noiseValue);
  const [lo, hi] = TIER_COLOUR_RANGE[tier];

  const tierLo = tier === ElevationTier.SUBMERGED ? 0
    : tier === ElevationTier.BASELAND  ? TIER_THRESHOLDS[0]
    : tier === ElevationTier.ELEVATED  ? TIER_THRESHOLDS[1]
    : TIER_THRESHOLDS[2];

  const tierHi = tier === ElevationTier.SUBMERGED ? TIER_THRESHOLDS[0]
    : tier === ElevationTier.BASELAND  ? TIER_THRESHOLDS[1]
    : tier === ElevationTier.ELEVATED  ? TIER_THRESHOLDS[2]
    : 1.0;

  const t = Math.max(0, Math.min(1, normalise(noiseValue, tierLo, tierHi) + (jitter - 0.5) * 0.15));
  return lerpColor(lo, hi, t);
}
