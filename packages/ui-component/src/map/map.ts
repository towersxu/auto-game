import { getChunkCoords, getLocalCoords } from '@auto-game/logic';

export interface MapOptions {
  /** Width of the map in grid cells */
  gridWidth?: number;
  /** Height of the map in grid cells */
  gridHeight?: number;
  /** Initial cell size in pixels (will be adjusted to fill canvas) */
  cellSize?: number;
  /** Color of grid lines (CSS color string or hex number) */
  gridColor?: string | number;
  /** Color of the map ground (CSS color string or hex number) */
  groundColor?: string | number;
}

export interface MapState {
  /** Pixel offset of the grid left edge from the canvas left edge */
  offsetX: number;
  /** Pixel offset of the grid top edge from the canvas top edge */
  offsetY: number;
  /** Current cell size in pixels (reflects zoom level) */
  cellSize: number;
}

/** Convert a numeric hex color (e.g. 0x4a7c59) or CSS string to a CSS color string */
function toColorString(color: string | number): string {
  if (typeof color === 'number') {
    return '#' + color.toString(16).padStart(6, '0');
  }
  return color;
}

/**
 * A 2D grid map rendered on an HTML Canvas element.
 *
 * Design guarantees:
 * - The grid always fills the entire canvas — no blank space is visible.
 * - Zooming out is limited so the total grid size never falls below the canvas size.
 * - Panning is clamped so the grid edges never expose empty canvas area.
 * - Each cell (col, row) maps to world coordinates via the coordinate-system module.
 */
export class GameMap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  readonly gridWidth: number;
  readonly gridHeight: number;

  private state: MapState;
  private gridColor: string;
  private groundColor: string;

  constructor(container: HTMLElement, options: MapOptions = {}) {
    this.gridWidth = options.gridWidth ?? 168;
    this.gridHeight = options.gridHeight ?? 168;
    this.gridColor = toColorString(options.gridColor ?? 0x888888);
    this.groundColor = toColorString(options.groundColor ?? 0x4a7c59);

    this.canvas = document.createElement('canvas');
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    // Compute the initial cell size: use the provided value, but enforce the
    // minimum so the full grid always covers the canvas.
    const minCell = this._computeMinCellSize();
    const cellSize = Math.max(minCell, options.cellSize ?? minCell);

    // Center the grid on the canvas initially.
    const offsetX = (this.canvas.width - this.gridWidth * cellSize) / 2;
    const offsetY = (this.canvas.height - this.gridHeight * cellSize) / 2;

    this.state = {
      cellSize,
      offsetX: this._clampOffsetX(offsetX, cellSize),
      offsetY: this._clampOffsetY(offsetY, cellSize),
    };

    this.render();
  }

  /**
   * Pan the map by (deltaX, deltaY) pixels.
   * The offset is clamped to keep the grid filling the canvas.
   */
  pan(deltaX: number, deltaY: number): void {
    const { cellSize } = this.state;
    this.state.offsetX = this._clampOffsetX(this.state.offsetX + deltaX, cellSize);
    this.state.offsetY = this._clampOffsetY(this.state.offsetY + deltaY, cellSize);
    this.render();
  }

  /** Reset to the initial centered view at minimum zoom. */
  center(): void {
    const cellSize = this._computeMinCellSize();
    const offsetX = (this.canvas.width - this.gridWidth * cellSize) / 2;
    const offsetY = (this.canvas.height - this.gridHeight * cellSize) / 2;
    this.state = {
      cellSize,
      offsetX: this._clampOffsetX(offsetX, cellSize),
      offsetY: this._clampOffsetY(offsetY, cellSize),
    };
    this.render();
  }

  /**
   * Zoom in by growing each cell by (factor * 100)%.
   * Zoom is applied toward the canvas center.
   */
  zoomIn(factor = 0.1): void {
    this._applyZoom(this.state.cellSize * (1 + factor));
  }

  /**
   * Zoom out by shrinking each cell by (factor * 100)%.
   * The cell size is clamped at the minimum required to fill the canvas.
   */
  zoomOut(factor = 0.1): void {
    const minCell = this._computeMinCellSize();
    this._applyZoom(Math.max(minCell, this.state.cellSize * (1 - factor)));
  }

  /** Return a snapshot of the current map state. */
  getState(): MapState {
    return { ...this.state };
  }

  /**
   * Notify the map that its container has been resized.
   * Re-clamps the current state so the canvas stays filled.
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    const minCell = this._computeMinCellSize();
    const cellSize = Math.max(this.state.cellSize, minCell);
    this.state.cellSize = cellSize;
    this.state.offsetX = this._clampOffsetX(this.state.offsetX, cellSize);
    this.state.offsetY = this._clampOffsetY(this.state.offsetY, cellSize);
    this.render();
  }

  /**
   * Return the world coordinate of the cell at grid position (col, row).
   * Uses the coordinate-system module for chunk and local coordinate resolution.
   */
  getCellCoordinate(col: number, row: number): {
    x: number;
    y: number;
    chunk: { cx: number; cy: number };
    local: { lx: number; ly: number };
  } {
    return {
      x: col,
      y: row,
      chunk: getChunkCoords(col, row),
      local: getLocalCoords(col, row),
    };
  }

  /** Render the current frame to the canvas. */
  render(): void {
    const { ctx, canvas } = this;
    const { offsetX, offsetY, cellSize } = this.state;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the ground fill.
    ctx.fillStyle = this.groundColor;
    ctx.fillRect(offsetX, offsetY, this.gridWidth * cellSize, this.gridHeight * cellSize);

    // Draw grid lines only for cells that intersect the visible canvas area.
    const startCol = Math.max(0, Math.floor(-offsetX / cellSize));
    const endCol = Math.min(this.gridWidth, Math.ceil((canvas.width - offsetX) / cellSize));
    const startRow = Math.max(0, Math.floor(-offsetY / cellSize));
    const endRow = Math.min(this.gridHeight, Math.ceil((canvas.height - offsetY) / cellSize));

    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let col = startCol; col <= endCol; col++) {
      const x = offsetX + col * cellSize;
      ctx.moveTo(x, offsetY + startRow * cellSize);
      ctx.lineTo(x, offsetY + endRow * cellSize);
    }

    for (let row = startRow; row <= endRow; row++) {
      const y = offsetY + row * cellSize;
      ctx.moveTo(offsetX + startCol * cellSize, y);
      ctx.lineTo(offsetX + endCol * cellSize, y);
    }

    ctx.stroke();
  }

  /** Remove the canvas element and release resources. */
  dispose(): void {
    this.canvas.remove();
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  /**
   * The smallest cell size (px) that guarantees the full grid covers the canvas
   * in both dimensions.
   * Returns 1 as a safe fallback when the canvas has no area (e.g. not yet
   * attached to a visible layout), so internal state remains consistent.
   */
  private _computeMinCellSize(): number {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      return 1;
    }
    return Math.max(
      this.canvas.width / this.gridWidth,
      this.canvas.height / this.gridHeight,
    );
  }

  /** Clamp offsetX so the grid always covers the full canvas width. */
  private _clampOffsetX(offsetX: number, cellSize: number): number {
    const minOffset = this.canvas.width - this.gridWidth * cellSize;
    return Math.min(0, Math.max(minOffset, offsetX));
  }

  /** Clamp offsetY so the grid always covers the full canvas height. */
  private _clampOffsetY(offsetY: number, cellSize: number): number {
    const minOffset = this.canvas.height - this.gridHeight * cellSize;
    return Math.min(0, Math.max(minOffset, offsetY));
  }

  /**
   * Apply a new cell size, keeping the canvas centre fixed in world space,
   * then re-clamp the offset.
   */
  private _applyZoom(newCellSize: number): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const ratio = newCellSize / this.state.cellSize;
    const newOffsetX = cx - (cx - this.state.offsetX) * ratio;
    const newOffsetY = cy - (cy - this.state.offsetY) * ratio;
    this.state.cellSize = newCellSize;
    this.state.offsetX = this._clampOffsetX(newOffsetX, newCellSize);
    this.state.offsetY = this._clampOffsetY(newOffsetY, newCellSize);
    this.render();
  }
}
