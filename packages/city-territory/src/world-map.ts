/**
 * WorldMap Module
 *
 * Resource manager that maintains global map boundaries and records all
 * coordinate occupation states.  Uses 1-based coordinate indexing:
 * valid x ∈ [1, width] and valid y ∈ [1, height].
 */

import { Coordinate } from './coordinate';
import type { City } from './city';

/**
 * WorldMap manages the global map boundaries and tracks which city occupies
 * each coordinate.
 */
export class WorldMap {
  public readonly width: number;
  public readonly height: number;

  private readonly _occupiedMap: Map<string, City>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this._occupiedMap = new Map();
  }

  /**
   * Read-only view of all occupied coordinate mappings.
   * Keys are coordinate string representations (e.g. "3,4").
   */
  get occupiedMap(): ReadonlyMap<string, City> {
    return this._occupiedMap;
  }

  /**
   * Check if a coordinate lies within the map boundaries.
   * Valid range: x ∈ [1, width] and y ∈ [1, height].
   */
  isInBounds(coord: Coordinate): boolean {
    return (
      coord.x >= 1 &&
      coord.x <= this.width &&
      coord.y >= 1 &&
      coord.y <= this.height
    );
  }

  /**
   * Check if a coordinate is within bounds and not yet occupied by any city.
   */
  isAvailable(coord: Coordinate): boolean {
    return this.isInBounds(coord) && !this._occupiedMap.has(coord.toString());
  }

  /**
   * Officially record that a city occupies the given coordinate.
   *
   * @throws {Error} If the coordinate is outside the map boundaries.
   */
  registerOccupation(coord: Coordinate, city: City): void {
    if (!this.isInBounds(coord)) {
      throw new Error(
        `Coordinate ${coord.toString()} is out of bounds (map size: ${this.width}x${this.height})`,
      );
    }
    this._occupiedMap.set(coord.toString(), city);
  }

  /**
   * Get the city that occupies the given coordinate.
   *
   * @returns The occupying city, or undefined if the coordinate is unoccupied.
   */
  getOccupant(coord: Coordinate): City | undefined {
    return this._occupiedMap.get(coord.toString());
  }
}
