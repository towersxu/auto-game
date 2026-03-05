/**
 * Coordinate Module
 *
 * A value object encapsulating 2D coordinate data and providing mathematical utilities.
 * Coordinates use 1-based indexing to match the game's logical grid.
 * Can be referenced alongside logic/coordinate-system.ts for Manhattan distance helpers.
 */

/**
 * Immutable 2D coordinate value object.
 * Provides equality checks, distance calculation, and neighbor enumeration.
 */
export class Coordinate {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  /**
   * Check if this coordinate equals another coordinate.
   */
  equals(other: Coordinate): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /**
   * Calculate the Manhattan distance to another coordinate.
   *
   * @example
   * new Coordinate(1, 1).distanceTo(new Coordinate(1, 2)) // returns 1
   * new Coordinate(1, 1).distanceTo(new Coordinate(3, 4)) // returns 5
   */
  distanceTo(other: Coordinate): number {
    return Math.abs(other.x - this.x) + Math.abs(other.y - this.y);
  }

  /**
   * Get all orthogonally adjacent coordinates (up, down, left, right).
   */
  getNeighbors(): Coordinate[] {
    return [
      new Coordinate(this.x - 1, this.y),
      new Coordinate(this.x + 1, this.y),
      new Coordinate(this.x, this.y - 1),
      new Coordinate(this.x, this.y + 1),
    ];
  }

  /**
   * Convert to string key, suitable for use in Maps and Sets.
   *
   * @example
   * new Coordinate(3, 4).toString() // returns '3,4'
   */
  toString(): string {
    return `${this.x},${this.y}`;
  }

  /**
   * Create a Coordinate from its string representation produced by toString().
   *
   * @example
   * Coordinate.fromString('3,4') // returns new Coordinate(3, 4)
   */
  static fromString(str: string): Coordinate {
    const parts = str.split(',');
    return new Coordinate(Number(parts[0]), Number(parts[1]));
  }
}
