/**
 * Hex Grid utilities for pointy-top hexagons using axial coordinates (q, r).
 *
 * Axial Coordinate System:
 *   q – column axis (pointing east)
 *   r – row axis (pointing south-east)
 *   s – derived: s = −q − r  (cube coordinate constraint)
 *
 * World / screen mapping (XZ ground plane, Y is up):
 *   x = size * √3 * (q + r / 2)
 *   z = size * 1.5 * r
 */

/** √3 constant reused throughout hex math. */
const SQRT3 = Math.sqrt(3);

export interface AxialCoord {
  q: number;
  r: number;
}

export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

/** Convert axial coordinates to cube coordinates. */
export function axialToCube(q: number, r: number): CubeCoord {
  return { q, r, s: -q - r };
}

/**
 * The 6 axial-direction vectors for pointy-top hexagons,
 * indexed 0–5 going clockwise from East.
 * Direction d is also the index of the edge on hex A that is shared with
 * the neighbor in direction d.
 */
export const HEX_DIRECTIONS: readonly AxialCoord[] = [
  { q: 1, r: 0 },   // 0 – E
  { q: 1, r: -1 },  // 1 – NE
  { q: 0, r: -1 },  // 2 – NW
  { q: -1, r: 0 },  // 3 – W
  { q: -1, r: 1 },  // 4 – SW
  { q: 0, r: 1 },   // 5 – SE
];

/** Return the 6 axial neighbors of hex (q, r). */
export function getNeighbors(q: number, r: number): AxialCoord[] {
  return HEX_DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
}

/**
 * Cube distance (= hex distance) between two hexes.
 * O(1) with no allocations.
 */
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return Math.max(
    Math.abs(q1 - q2),
    Math.abs(r1 - r2),
    Math.abs((-q1 - r1) - (-q2 - r2)),
  );
}

/**
 * Convert axial hex coordinates to world (XZ) position for pointy-top hexagons.
 * @param size – hex outer radius (centre → corner), in world units.
 */
export function hexToWorld(q: number, r: number, size: number): { x: number; z: number } {
  return {
    x: size * SQRT3 * (q + r / 2),
    z: size * 1.5 * r,
  };
}

/**
 * Convert world (XZ) position to the nearest hex axial coordinate.
 * @param size – hex outer radius.
 */
export function worldToHex(x: number, z: number, size: number): AxialCoord {
  const q = (x * SQRT3 / 3 - z / 3) / size;
  const r = (z * 2) / 3 / size;
  return hexRound(q, r);
}

/** Round fractional axial coordinates to the nearest integer hex (cube rounding). */
export function hexRound(fq: number, fr: number): AxialCoord {
  const fs = -fq - fr;
  let rq = Math.round(fq);
  let rr = Math.round(fr);
  let rs = Math.round(fs);

  const dq = Math.abs(rq - fq);
  const dr = Math.abs(rr - fr);
  const ds = Math.abs(rs - fs);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else rs = -rq - rr  (drop s since we don't need it)
  return { q: rq, r: rr };
}

/**
 * World position of corner `i` (0–5) of the hex centred at (cx, cz).
 * Corners are numbered clockwise from the top (-Z) vertex for pointy-top.
 * Corner 0 is "north" (−Z), corner 1 is "north-east", etc.
 */
export function hexCornerWorld(
  cx: number,
  cz: number,
  size: number,
  cornerIndex: number,
): { x: number; z: number } {
  // For pointy-top: corner i is at angle  (60° * i − 90°)
  // (corner 0 points straight up / north = −Z direction)
  const angleDeg = 60 * cornerIndex - 90;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + size * Math.cos(rad),
    z: cz + size * Math.sin(rad),
  };
}

/**
 * Return the direction index (0–5) from hex A to adjacent hex B.
 * Returns -1 if B is not a direct neighbour of A.
 */
export function getDirectionIndex(aq: number, ar: number, bq: number, br: number): number {
  const dq = bq - aq;
  const dr = br - ar;
  return HEX_DIRECTIONS.findIndex(d => d.q === dq && d.r === dr);
}

/**
 * Generate all hex axial coordinates for a rectangular region.
 * The region is defined as q ∈ [0, cols) × r ∈ [0, rows).
 * This produces a parallelogram in hex space which appears roughly
 * rectangular when rendered on-screen.
 */
export function generateRectGrid(cols: number, rows: number): AxialCoord[] {
  const hexes: AxialCoord[] = [];
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}

/**
 * Return all hexes within `radius` hex-steps of (cq, cr), inclusive.
 * Results are not guaranteed to be within the grid bounds; callers should
 * filter as needed.
 */
export function hexesInRadius(cq: number, cr: number, radius: number): AxialCoord[] {
  const results: AxialCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      results.push({ q: cq + q, r: cr + r });
    }
  }
  return results;
}
