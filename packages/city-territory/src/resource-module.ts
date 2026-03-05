/**
 * ResourceModule
 *
 * Configuration-driven resource generator for map tiles.
 * Each tile receives a random set of resources whose total score
 * does not exceed a configurable maximum, with a guarantee that
 * every tile has at least one resource (score > 0).
 *
 * Resources are defined as prototypes: `{ name: string, score: number }`.
 * The module uses a SeedSystem instance so results are fully deterministic.
 */

import { SeedSystem } from './seed-system';

// ── Public types ────────────────────────────────────────────────────────────

/** A resource prototype — the "template" for a resource type. */
export interface ResourcePrototype {
  /** Display name, e.g. "Grain", "Forest". */
  name: string;
  /** Score value of a single unit of this resource. */
  score: number;
}

/** A single resource instance assigned to a tile. */
export interface TileResource {
  /** The prototype this instance was created from. */
  name: string;
  /** Score contributed by this instance. */
  score: number;
}

/** The complete resource payload for one tile. */
export interface TileResourceData {
  /** All resource instances on this tile. */
  resources: TileResource[];
  /** Sum of all resource scores. */
  totalScore: number;
}

/** Configuration for the ResourceModule. */
export interface ResourceModuleConfig {
  /** Available resource prototypes. */
  prototypes: ResourcePrototype[];
  /** Maximum total score allowed per tile. */
  maxScore: number;
  /**
   * Probability (0–1) of continuing to add another resource during the fill
   * step.  Lower values produce more low-score tiles.  Default: 0.5.
   */
  fillChance: number;
}

// ── Default configuration ───────────────────────────────────────────────────

export const DEFAULT_PROTOTYPES: ResourcePrototype[] = [
  { name: 'Grain', score: 2 },
  { name: 'Forest', score: 3 },
  { name: 'Gold', score: 5 },
  { name: 'Wonder', score: 10 },
];

export const DEFAULT_MAX_SCORE = 10;

// ── ResourceModule class ────────────────────────────────────────────────────

/**
 * Generates deterministic resource allocations for map tiles.
 *
 * Algorithm:
 * 1. **Guarantee step** — pick one random resource (from those that fit)
 *    so every tile has score > 0.
 * 2. **Fill step** — on each iteration, roll a random number; if it
 *    exceeds `fillChance` the tile stops filling early.  This produces
 *    a natural distribution of low, medium, and high-score tiles.
 */
export class ResourceModule {
  public readonly prototypes: ResourcePrototype[];
  public readonly maxScore: number;
  public readonly fillChance: number;

  constructor(config?: Partial<ResourceModuleConfig>) {
    this.prototypes = config?.prototypes ?? DEFAULT_PROTOTYPES;
    this.maxScore = config?.maxScore ?? DEFAULT_MAX_SCORE;
    this.fillChance = config?.fillChance ?? 0.5;
  }

  /**
   * Generate resources for a single tile.
   *
   * @param rng - The SeedSystem instance to draw random numbers from.
   * @returns The generated resource data for the tile.
   */
  generateForTile(rng: SeedSystem): TileResourceData {
    const resources: TileResource[] = [];
    let totalScore = 0;

    // Determine which prototypes can fit within the max score budget.
    const fittable = this.prototypes.filter(p => p.score <= this.maxScore);
    if (fittable.length === 0) {
      // No resource can fit — return empty (edge case: all prototypes exceed maxScore).
      return { resources, totalScore };
    }

    // 1. Guarantee step: add at least one resource.
    const first = rng.choice(fittable);
    resources.push({ name: first.name, score: first.score });
    totalScore += first.score;

    // 2. Fill step: each iteration has a `fillChance` probability of
    //    continuing.  This prevents tiles from always filling to max.
    let remaining = this.maxScore - totalScore;
    let candidates = fittable.filter(p => p.score <= remaining);

    while (candidates.length > 0 && rng.nextFloat() < this.fillChance) {
      const pick = rng.choice(candidates);
      resources.push({ name: pick.name, score: pick.score });
      totalScore += pick.score;
      remaining = this.maxScore - totalScore;
      candidates = fittable.filter(p => p.score <= remaining);
    }

    return { resources, totalScore };
  }

  /**
   * Generate resources for an entire grid of tiles.
   *
   * The seed string is combined with each tile's coordinate so that
   * every tile gets a unique but deterministic sub-sequence.
   *
   * @param seed  - Base seed string for the world.
   * @param width - Number of columns (1-based: x in [1, width]).
   * @param height - Number of rows (1-based: y in [1, height]).
   * @returns A Map keyed by "x,y" coordinate strings.
   */
  generateForGrid(
    seed: string,
    width: number,
    height: number,
  ): Map<string, TileResourceData> {
    const result = new Map<string, TileResourceData>();
    for (let y = 1; y <= height; y++) {
      for (let x = 1; x <= width; x++) {
        const tileSeed = `${seed}:tile:${x},${y}`;
        const rng = new SeedSystem(tileSeed);
        const key = `${x},${y}`;
        result.set(key, this.generateForTile(rng));
      }
    }
    return result;
  }
}
