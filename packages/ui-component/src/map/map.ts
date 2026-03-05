import * as THREE from 'three';
import { getChunkCoords, getLocalCoords } from '@auto-game/logic';

export interface MapOptions {
  /** Width of the map in grid cells */
  gridWidth?: number;
  /** Height of the map in grid cells */
  gridHeight?: number;
  /** Initial cell size in pixels (will be adjusted to fill canvas) */
  cellSize?: number;
  /** Color of grid lines (hex number or CSS color string) */
  gridColor?: string | number;
  /** Color of the map ground (hex number or CSS color string) */
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

/** Convert a CSS color string or numeric hex color to a Three.js color number. */
function toColorHex(color: string | number): number {
  if (typeof color === 'number') return color;
  return parseInt(color.replace(/^#/, ''), 16);
}

/**
 * Height of the orthographic camera above the XZ ground plane.
 * Any positive value large enough to keep the grid visible works; the
 * orthographic projection makes the actual height irrelevant for appearance.
 */
const CAMERA_HEIGHT = 1000;

/**
 * A 3D grid map rendered with Three.js using a fixed top-down (orthographic)
 * camera.  The public API is identical to the previous 2D Canvas version so
 * that all callers (MapController, map-demo, etc.) continue to work unchanged.
 *
 * Design guarantees (identical to the 2D version):
 * - The grid always fills the entire canvas — no blank space is visible.
 * - Zooming out is limited so the total grid size never falls below the canvas.
 * - Panning is clamped so the grid edges never expose empty canvas area.
 * - Each cell (col, row) maps to world coordinates via the coordinate-system module.
 *
 * Coordinate mapping (canvas px → Three.js world units):
 *   One cell = 1 world unit on the XZ plane.
 *   Canvas X  ↔  World X
 *   Canvas Y  ↔  World Z  (camera.up = (0, 0, −1) so +Z is screen-down)
 */
export class GameMap {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  readonly gridWidth: number;
  readonly gridHeight: number;

  private state: MapState;

  /** Current camera tilt angle in radians (0 = pure top-down, π/4 = 45° isometric tilt). */
  private _tiltAngle = 0;

  /** ID of the in-progress tilt animation (null when idle). */
  private _animId: number | null = null;

  /** Map of per-cell colour overlay meshes keyed by "col:row". */
  private _cellMeshes: Map<string, THREE.Mesh> = new Map();

  /** Map of per-cell label sprites keyed by "col:row". */
  private _labelSprites: Map<string, THREE.Sprite> = new Map();

  /** Optional handler called when a grid cell is clicked. */
  private _clickHandler: ((col: number, row: number) => void) | null = null;

  constructor(container: HTMLElement, options: MapOptions = {}) {
    this.gridWidth = options.gridWidth ?? 168;
    this.gridHeight = options.gridHeight ?? 168;

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    // ── Three.js renderer ────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio ?? 1);
    container.appendChild(this.renderer.domElement);

    // ── Orthographic camera – fixed top-down perspective ─────────────────────
    // camera.up = (0,0,−1) means the −Z world direction maps to screen-up,
    // so +Z increases downward (matching canvas Y direction).
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 1, CAMERA_HEIGHT + 1);
    this.camera.up.set(0, 0, -1);
    this.camera.position.set(0, CAMERA_HEIGHT, 0);
    this.camera.lookAt(0, 0, 0);

    // ── Scene ────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this._buildScene(options);

    // ── Initial state ────────────────────────────────────────────────────────
    const minCell = this._computeMinCellSize();
    const cellSize = Math.max(minCell, options.cellSize ?? minCell);
    const offsetX = (w - this.gridWidth * cellSize) / 2;
    const offsetY = (h - this.gridHeight * cellSize) / 2;

    this.state = {
      cellSize,
      offsetX: this._clampOffsetX(offsetX, cellSize),
      offsetY: this._clampOffsetY(offsetY, cellSize),
    };

    this.renderer.domElement.addEventListener('click', this._handleClick.bind(this));

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
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    const cellSize = this._computeMinCellSize();
    const offsetX = (w - this.gridWidth * cellSize) / 2;
    const offsetY = (h - this.gridHeight * cellSize) / 2;
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
    this.renderer.setSize(width, height);
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

  // ─── cell colour API ─────────────────────────────────────────────────────

  /**
   * Set the colour overlay for a single grid cell.
   * Call with color = null to clear a previously applied colour.
   *
   * @param col   - 0-based column index (0 ≤ col < gridWidth).
   * @param row   - 0-based row index (0 ≤ row < gridHeight).
   * @param color - Three.js hex colour number, or null to clear.
   */
  setCellColor(col: number, row: number, color: number | null): void {
    const key = `${col}:${row}`;
    const existing = this._cellMeshes.get(key);
    if (existing) {
      this.scene.remove(existing);
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
      this._cellMeshes.delete(key);
    }
    if (color !== null) {
      const geo = new THREE.PlaneGeometry(0.9, 0.9);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(col + 0.5, 0.01, row + 0.5);
      this.scene.add(mesh);
      this._cellMeshes.set(key, mesh);
    }
    this.render();
  }

  /**
   * Set a text + icon label overlay for a single grid cell.
   * The label is rendered as a canvas-textured sprite placed just above
   * the cell surface.
   *
   * @param col   - 0-based column index.
   * @param row   - 0-based row index.
   * @param score - Score text to display at top-right (e.g. "8").
   * @param icons - Array of emoji / short strings to display in the centre.
   * @param scoreColor - Optional CSS colour for the score text (default "#FFD700").
   */
  setCellLabel(
    col: number,
    row: number,
    score: string,
    icons: string[],
    scoreColor = '#FFD700',
  ): void {
    const key = `${col}:${row}`;
    const existing = this._labelSprites.get(key);
    if (existing) {
      this.scene.remove(existing);
      existing.geometry.dispose();
      (existing.material as THREE.SpriteMaterial).map?.dispose();
      (existing.material as THREE.SpriteMaterial).dispose();
      this._labelSprites.delete(key);
    }

    // Draw the label onto a 2D canvas and use it as a sprite texture.
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Score — top-right
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = scoreColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(score, size - 6, 6);

    // Icons — centred, wrapping into rows of up to 3
    const iconSize = 28;
    const cols = Math.min(icons.length, 3);
    const rows = Math.ceil(icons.length / 3);
    const startX = (size - cols * iconSize) / 2;
    const startY = (size - rows * iconSize) / 2 + 8; // shift slightly below centre
    ctx.font = `${iconSize - 4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    icons.forEach((icon, i) => {
      const r = Math.floor(i / 3);
      const c = i % 3;
      ctx.fillText(icon, startX + c * iconSize + iconSize / 2, startY + r * iconSize + iconSize / 2);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 0.9, 1);
    sprite.position.set(col + 0.5, 0.02, row + 0.5);
    this.scene.add(sprite);
    this._labelSprites.set(key, sprite);
    this.render();
  }

  /**
   * Register a callback that fires whenever the user clicks a grid cell.
   * The callback receives 0-based (col, row) coordinates.
   * Passing null removes any previously registered handler.
   */
  onCellClick(callback: ((col: number, row: number) => void) | null): void {
    this._clickHandler = callback;
  }

  /**
   * Render the current frame.
   * Updates the orthographic camera frustum and position to match the current
   * pan/zoom state, then calls renderer.render().
   */
  render(): void {
    const { offsetX, offsetY, cellSize } = this.state;
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;

    // Derive the camera centre in world (XZ) coordinates.
    // offsetX = w/2 − worldCX * cellSize  →  worldCX = (w/2 − offsetX) / cellSize
    const worldCX = (w / 2 - offsetX) / cellSize;
    const worldCZ = (h / 2 - offsetY) / cellSize;

    // Update frustum so that one pixel corresponds to (1 / cellSize) world units.
    const halfW = w / 2 / cellSize;
    const halfH = h / 2 / cellSize;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    // Apply tilt: camera orbits over the target point in the vertical XZ plane.
    // At theta=0 the camera is directly above (pure top-down); at theta>0 it
    // is pulled back along –Z (south) and down, giving an isometric-like view.
    const theta = this._tiltAngle;
    this.camera.position.set(
      worldCX,
      CAMERA_HEIGHT * Math.cos(theta),
      worldCZ - CAMERA_HEIGHT * Math.sin(theta),
    );
    // up vector: orthogonal to look direction, keeps world –Z at top of screen.
    this.camera.up.set(0, -Math.sin(theta), -Math.cos(theta));
    this.camera.lookAt(worldCX, 0, worldCZ);

    this.renderer.render(this.scene, this.camera);
  }

  /** Remove the canvas element and release Three.js resources. */
  dispose(): void {
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
    for (const mesh of this._cellMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this._cellMeshes.clear();
    for (const sprite of this._labelSprites.values()) {
      this.scene.remove(sprite);
      sprite.geometry.dispose();
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
      (sprite.material as THREE.SpriteMaterial).dispose();
    }
    this._labelSprites.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ─── view-angle API ───────────────────────────────────────────────────────

  /** Return the current camera tilt angle in radians (0 = pure top-down). */
  getTiltAngle(): number {
    return this._tiltAngle;
  }

  /**
   * Smoothly animate the camera to a tilted (isometric-like) orthographic view.
   * @param angle - Target tilt angle in radians (default π/4 = 45°).
   */
  tiltView(angle = Math.PI / 4): void {
    this._animateTilt(this._tiltAngle, angle);
  }

  /** Smoothly animate the camera back to a pure top-down (俯视) view. */
  topDownView(): void {
    this._animateTilt(this._tiltAngle, 0);
  }

  /**
   * Animate the tilt angle from `from` to `to` over `durationMs` milliseconds.
   * Any in-progress animation is cancelled before starting the new one.
   */
  private _animateTilt(from: number, to: number, durationMs = 600): void {
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
    if (from === to) return;
    const startTime = performance.now();
    const step = (now: number): void => {
      const t = Math.min((now - startTime) / durationMs, 1);
      // Smooth-step easing: t²(3 − 2t)
      const eased = t * t * (3 - 2 * t);
      this._tiltAngle = from + (to - from) * eased;
      this.render();
      if (t < 1) {
        this._animId = requestAnimationFrame(step);
      } else {
        this._animId = null;
      }
    };
    this._animId = requestAnimationFrame(step);
  }

  /**
   * Convert a DOM click event into a grid (col, row) and invoke the click
   * handler if one is registered.  Accounts for CSS scaling of the canvas.
   */
  private _handleClick(event: MouseEvent): void {
    if (!this._clickHandler) return;
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    const { offsetX, offsetY, cellSize } = this.state;
    const col = Math.floor((canvasX - offsetX) / cellSize);
    const row = Math.floor((canvasY - offsetY) / cellSize);
    if (col >= 0 && col < this.gridWidth && row >= 0 && row < this.gridHeight) {
      this._clickHandler(col, row);
    }
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  /**
   * Build the Three.js scene: a flat ground plane and a grid of line segments,
   * both lying on the XZ plane spanning (0,0,0) → (gridWidth, 0, gridHeight).
   */
  private _buildScene(options: MapOptions): void {
    const groundColor = toColorHex(options.groundColor ?? 0x4a7c59);
    const gridColor = toColorHex(options.gridColor ?? 0x888888);

    // Scene background (sky colour, visible when camera is tilted)
    this.scene.background = new THREE.Color(0x87ceeb);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(this.gridWidth / 2, CAMERA_HEIGHT / 2, -this.gridHeight);
    this.scene.add(dirLight);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(this.gridWidth, this.gridHeight);
    const groundMat = new THREE.MeshLambertMaterial({ color: groundColor });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(this.gridWidth / 2, 0, this.gridHeight / 2);
    this.scene.add(ground);

    // Grid lines (vertical = along Z, horizontal = along X)
    const positions: number[] = [];
    for (let col = 0; col <= this.gridWidth; col++) {
      positions.push(col, 0, 0, col, 0, this.gridHeight);
    }
    for (let row = 0; row <= this.gridHeight; row++) {
      positions.push(0, 0, row, this.gridWidth, 0, row);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: gridColor });
    this.scene.add(new THREE.LineSegments(lineGeo, lineMat));
  }

  /**
   * The smallest cell size (px) that guarantees the full grid covers the canvas
   * in both dimensions.
   * Returns 1 as a safe fallback when the canvas has no area.
   */
  private _computeMinCellSize(): number {
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    if (w === 0 || h === 0) return 1;
    return Math.max(w / this.gridWidth, h / this.gridHeight);
  }

  /** Clamp offsetX so the grid always covers the full canvas width. */
  private _clampOffsetX(offsetX: number, cellSize: number): number {
    const minOffset = this.renderer.domElement.width - this.gridWidth * cellSize;
    return Math.min(0, Math.max(minOffset, offsetX));
  }

  /** Clamp offsetY so the grid always covers the full canvas height. */
  private _clampOffsetY(offsetY: number, cellSize: number): number {
    const minOffset = this.renderer.domElement.height - this.gridHeight * cellSize;
    return Math.min(0, Math.max(minOffset, offsetY));
  }

  /**
   * Apply a new cell size, keeping the canvas centre fixed in world space,
   * then re-clamp the offset.
   */
  private _applyZoom(newCellSize: number): void {
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    const cx = w / 2;
    const cy = h / 2;
    const ratio = newCellSize / this.state.cellSize;
    const newOffsetX = cx - (cx - this.state.offsetX) * ratio;
    const newOffsetY = cy - (cy - this.state.offsetY) * ratio;
    this.state.cellSize = newCellSize;
    this.state.offsetX = this._clampOffsetX(newOffsetX, newCellSize);
    this.state.offsetY = this._clampOffsetY(newOffsetY, newCellSize);
    this.render();
  }
}
