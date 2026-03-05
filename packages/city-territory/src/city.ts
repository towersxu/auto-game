/**
 * City Module
 *
 * Business entity that handles territory expansion rules.
 * A city can expand to orthogonally adjacent, unoccupied, in-bounds coordinates.
 */

import { Coordinate } from './coordinate';
import type { WorldMap } from './world-map';

/**
 * City represents a game city that can claim map territory.
 *
 * Expansion rules (enforced in addArea):
 * 1. The target coordinate must be available on the world map
 *    (within bounds and not yet occupied).
 * 2. If the city already has territory, the target must be orthogonally
 *    adjacent (Manhattan distance = 1) to at least one existing tile.
 */
export class City {
  public readonly id: string;
  public readonly name: string;

  /** All coordinates currently occupied by this city. */
  public readonly territoryList: Coordinate[];

  private readonly worldMap: WorldMap;

  constructor(id: string, name: string, worldMap: WorldMap) {
    this.id = id;
    this.name = name;
    this.worldMap = worldMap;
    this.territoryList = [];
  }

  /**
   * Check if a coordinate is orthogonally adjacent (distance = 1) to any
   * existing territory tile.
   */
  isAdjacentTo(coord: Coordinate): boolean {
    return this.territoryList.some(tile => tile.distanceTo(coord) === 1);
  }

  /**
   * Attempt to expand the city territory to include a new coordinate.
   *
   * @returns true if the expansion succeeded, false if validation failed.
   */
  addArea(newCoord: Coordinate): boolean {
    if (!this.worldMap.isAvailable(newCoord)) {
      return false;
    }
    if (this.territoryList.length > 0 && !this.isAdjacentTo(newCoord)) {
      return false;
    }
    this.territoryList.push(newCoord);
    this.worldMap.registerOccupation(newCoord, this);
    return true;
  }
}
