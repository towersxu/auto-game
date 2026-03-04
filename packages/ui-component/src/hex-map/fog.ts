/**
 * Fog-of-war state definitions and per-cell management.
 *
 * Three states:
 *   UNCHARTED – never explored; rendered as a dark flat overlay.
 *   SHROUD    – explored but currently out of sight; desaturated grey-tone.
 *   VISIBLE   – fully lit, real-time rendering.
 */

export const enum FogState {
  UNCHARTED = 0,
  SHROUD    = 1,
  VISIBLE   = 2,
}

/**
 * Manages fog state for a cols × rows hex grid.
 * All cells start as UNCHARTED.
 */
export class FogManager {
  private readonly _state: Uint8Array;
  readonly cols: number;
  readonly rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this._state = new Uint8Array(cols * rows).fill(FogState.UNCHARTED);
  }

  /** Return the fog state of cell (q, r). */
  getState(q: number, r: number): FogState {
    if (q < 0 || q >= this.cols || r < 0 || r >= this.rows) return FogState.UNCHARTED;
    return this._state[r * this.cols + q] as FogState;
  }

  /** Directly set the fog state of cell (q, r). */
  setState(q: number, r: number, state: FogState): void {
    if (q < 0 || q >= this.cols || r < 0 || r >= this.rows) return;
    this._state[r * this.cols + q] = state;
  }

  /**
   * Reveal a circular area of radius `hexRadius` hex-steps around (cq, cr).
   * All cells in the radius become VISIBLE; cells that were previously VISIBLE
   * and are now outside the radius become SHROUD.
   *
   * @param visibleCoords - Full set of currently-visible coords (replaces old visibility).
   */
  revealAt(cq: number, cr: number, hexRadius: number): void {
    // Mark all currently VISIBLE cells as SHROUD first.
    for (let i = 0; i < this._state.length; i++) {
      if (this._state[i] === FogState.VISIBLE) {
        this._state[i] = FogState.SHROUD;
      }
    }
    // Then reveal the new visible area.
    for (let dq = -hexRadius; dq <= hexRadius; dq++) {
      const rMin = Math.max(-hexRadius, -dq - hexRadius);
      const rMax = Math.min(hexRadius, -dq + hexRadius);
      for (let dr = rMin; dr <= rMax; dr++) {
        this.setState(cq + dq, cr + dr, FogState.VISIBLE);
      }
    }
  }

  /**
   * Unconditionally mark a cell visible (e.g., an initial "reveal all" cheat).
   */
  revealAll(): void {
    this._state.fill(FogState.VISIBLE);
  }
}
