/**
 * Edge-based river generation.
 *
 * Rivers flow along hex *edges* (not through hex centres) from high-elevation
 * source hexes down to SUBMERGED tiles or the map boundary.
 *
 * Algorithm:
 *  1. Pick the top-N highest hexes as source candidates.
 *  2. From each source, greedily descend to the neighbor with the lowest
 *     elevation (with a small random tie-break to avoid perfectly straight rivers).
 *  3. Record each traversed edge as a pair of (hex-A, hex-B) axial coordinates.
 *  4. Stop when reaching a SUBMERGED tile, the map boundary, or a visited edge.
 *
 * A RiverEdge is the half-edge owned by hex A in direction `dir` (0–5).
 * The world-space line segment can be recovered via hexCornerWorld.
 */

import { type AxialCoord, HEX_DIRECTIONS, getDirectionIndex } from './hex-grid.js';
import { getElevationTier, ElevationTier } from './terrain.js';

export interface RiverEdge {
  /** Axial coordinate of the "upstream" hex. */
  aq: number;
  ar: number;
  /** Axial coordinate of the "downstream" hex. */
  bq: number;
  br: number;
  /** Direction index (0–5) from A to B. */
  dir: number;
}

/**
 * Generate rivers for the given noise / elevation grid.
 *
 * @param elevations  - Flat array of noise values, indexed as [r * cols + q].
 * @param cols        - Grid width in hexes.
 * @param rows        - Grid height in hexes.
 * @param riverCount  - Maximum number of river sources to attempt.
 * @param seed        - PRNG seed for tie-breaking.
 */
export function generateRivers(
  elevations: Float32Array,
  cols: number,
  rows: number,
  riverCount: number,
  seed: number,
): RiverEdge[] {
  const edges: RiverEdge[] = [];
  const visitedEdges = new Set<string>();

  /** Elevation of cell (q, r), or -1 if out of bounds. */
  function elev(q: number, r: number): number {
    if (q < 0 || q >= cols || r < 0 || r >= rows) return -1;
    return elevations[r * cols + q];
  }

  /** Simple integer hash for PRNG-like jitter. */
  function rng(q: number, r: number, s: number): number {
    let h = (seed ^ (q * 1619)) ^ (r * 31337) ^ (s * 73939133);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
  }

  // Collect all PEAK cells as potential sources, sorted by elevation desc.
  const sources: AxialCoord[] = [];
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      if (getElevationTier(elev(q, r)) === ElevationTier.PEAK) {
        sources.push({ q, r });
      }
    }
  }
  sources.sort((a, b) => elev(b.q, b.r) - elev(a.q, a.r));

  const used = new Set<string>();
  let started = 0;

  for (const src of sources) {
    if (started >= riverCount) break;
    const key = `${src.q}:${src.r}`;
    if (used.has(key)) continue;
    used.add(key);
    started++;

    let { q, r } = src;
    const maxSteps = cols + rows; // Prevent infinite loops.

    for (let step = 0; step < maxSteps; step++) {
      const currentElev = elev(q, r);
      if (currentElev < 0) break; // out of bounds

      // Stop when reaching submerged terrain.
      if (getElevationTier(currentElev) === ElevationTier.SUBMERGED) break;

      // Find the neighbor with the lowest elevation.
      let bestDir = -1;
      let bestElev = currentElev; // must flow downhill
      for (let d = 0; d < 6; d++) {
        const nq = q + HEX_DIRECTIONS[d].q;
        const nr = r + HEX_DIRECTIONS[d].r;
        const ne = elev(nq, nr);
        if (ne < 0) continue; // boundary
        // Add a tiny jitter to break ties.
        const je = ne + rng(nq, nr, step) * 0.001;
        if (je < bestElev) {
          bestElev = je;
          bestDir = d;
        }
      }

      if (bestDir === -1) break; // stuck at a local minimum

      const nq = q + HEX_DIRECTIONS[bestDir].q;
      const nr = r + HEX_DIRECTIONS[bestDir].r;
      const edgeKey = `${q}:${r}->${bestDir}`;
      if (visitedEdges.has(edgeKey)) break; // avoid revisiting edges
      visitedEdges.add(edgeKey);

      const dir = getDirectionIndex(q, r, nq, nr);
      edges.push({ aq: q, ar: r, bq: nq, br: nr, dir });

      q = nq;
      r = nr;
    }
  }

  return edges;
}
