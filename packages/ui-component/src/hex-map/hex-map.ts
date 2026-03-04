/**
 * HexMap – Three.js renderer for a pointy-top hexagonal terrain map.
 *
 * Architecture highlights
 * ──────────────────────
 * • Instanced rendering: a single THREE.InstancedMesh renders all hex prisms
 *   with per-instance colour and matrix (position + height scale).
 * • Perspective camera: pitch locked in [MIN_PITCH, MAX_PITCH] (30°–70°).
 * • Parallax zoom: changes the camera-to-target distance; the frustum adapts.
 * • Mouse hover: O(1) raycasting against a flat Y=0 plane, then nearest-hex
 *   conversion – no expensive mesh raycasting needed.
 * • Fog of war: per-cell FogState alters instance colours in-place.
 * • Edge-based rivers: rendered as a separate LineSegments object.
 * • Frustum culling: Three.js built-in frustum culling handles visible-only
 *   instance updates via frustumCulled flag.
 */

import * as THREE from 'three';
import { octaveNoise } from './noise.js';
import { terrainColor, noiseToWorldHeight, getElevationTier, ElevationTier } from './terrain.js';
import { generateRivers, type RiverEdge } from './river.js';
import { FogManager, FogState } from './fog.js';
import {
  hexToWorld,
  worldToHex,
  hexCornerWorld,
  generateRectGrid,
  type AxialCoord,
} from './hex-grid.js';

// ─── Camera constants ────────────────────────────────────────────────────────

/** Minimum pitch (30°) – shallowest allowed viewing angle. */
const MIN_PITCH = Math.PI / 6;
/** Maximum pitch (70°) – steepest allowed viewing angle. */
const MAX_PITCH = (7 * Math.PI) / 18;

// ─── Visual constants ────────────────────────────────────────────────────────

const WATER_COLOR  = 0x1a5e9a;
const RIVER_COLOR  = 0x3a8fd9;
const FOG_UNCHARTED_COLOR: [number, number, number] = [0.08, 0.08, 0.10];
const SHROUD_SATURATION_FACTOR = 0.25;
const SHROUD_LIGHTNESS_FACTOR  = 0.55;

// ─── Public types ────────────────────────────────────────────────────────────

export interface HexMapOptions {
  /** Number of hex columns (default 50). */
  cols?: number;
  /** Number of hex rows (default 50). */
  rows?: number;
  /**
   * Outer radius (centre → corner) of each hex in world units (default 1).
   * Effectively controls the "cell size" before zoom.
   */
  hexSize?: number;
  /** Noise seed for terrain generation (default 42). */
  seed?: number;
  /** Number of river sources to attempt generating (default 6). */
  riverCount?: number;
  /** Initial camera pitch in radians (default π/4 = 45°). */
  initialPitch?: number;
  /** Whether to start with all fog revealed (debug mode, default false). */
  revealAll?: boolean;
}

export interface HexMapState {
  /** World-space coordinate the camera is looking at. */
  targetX: number;
  targetZ: number;
  /** Camera distance from the look-at target (controls zoom). */
  distance: number;
  /** Camera pitch in radians [MIN_PITCH, MAX_PITCH]. */
  pitch: number;
}

// ─── HexMap ──────────────────────────────────────────────────────────────────

export class HexMap {
  // ── Three.js objects ─────────────────────────────────────────────────────
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly hexMesh: THREE.InstancedMesh;
  private riverLines: THREE.LineSegments | null = null;

  // ── Grid metadata ─────────────────────────────────────────────────────────
  readonly cols: number;
  readonly rows: number;
  readonly hexSize: number;

  /** Flat elevation array [r * cols + q] – normalised noise value in [0, 1]. */
  private readonly _elevations: Float32Array;

  /** Fog-of-war manager. */
  readonly fog: FogManager;

  // ── Camera state ──────────────────────────────────────────────────────────
  private _state: HexMapState;

  // ── Hover state ───────────────────────────────────────────────────────────
  private _hovered: AxialCoord | null = null;
  private _hoveredPrevColor: THREE.Color | null = null;

  // ── Mouse drag ────────────────────────────────────────────────────────────
  private _dragStart: { x: number; y: number } | null = null;
  private _dragTargetStart: { x: number; z: number } | null = null;

  // ── Raycasting ────────────────────────────────────────────────────────────
  private readonly _raycaster = new THREE.Raycaster();
  private readonly _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ── Animation ─────────────────────────────────────────────────────────────
  private _animFrameId: number | null = null;

  constructor(container: HTMLElement, options: HexMapOptions = {}) {
    this.cols     = options.cols     ?? 50;
    this.rows     = options.rows     ?? 50;
    this.hexSize  = options.hexSize  ?? 1;
    const seed         = options.seed        ?? 42;
    const riverCount   = options.riverCount  ?? 6;
    const initialPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, options.initialPitch ?? Math.PI / 4));

    const w = container.clientWidth  || 800;
    const h = container.clientHeight || 600;

    // ── Renderer ────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // ── Camera ──────────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000);

    // ── Scene ────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    // ── Lighting ─────────────────────────────────────────────────────────────
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff0cc, 1.1);
    const cx = (this.cols * this.hexSize * Math.sqrt(3)) / 2;
    const cz = (this.rows * this.hexSize * 1.5) / 2;
    sun.position.set(cx + 30, 60, cz - 40);
    sun.castShadow = true;
    this.scene.add(sun);

    // ── Terrain data ─────────────────────────────────────────────────────────
    this._elevations = new Float32Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let q = 0; q < this.cols; q++) {
        this._elevations[r * this.cols + q] = octaveNoise(q, r, seed);
      }
    }

    // ── Fog of war ───────────────────────────────────────────────────────────
    this.fog = new FogManager(this.cols, this.rows);
    if (options.revealAll) this.fog.revealAll();

    // ── Instanced hex mesh ───────────────────────────────────────────────────
    const totalHexes = this.cols * this.rows;
    const hexGeo     = this._buildHexPrismGeometry();
    const hexMat     = new THREE.MeshLambertMaterial({ vertexColors: false });
    this.hexMesh     = new THREE.InstancedMesh(hexGeo, hexMat, totalHexes);
    this.hexMesh.castShadow    = true;
    this.hexMesh.receiveShadow = true;
    this.scene.add(this.hexMesh);

    // Populate instance matrices and colours.
    this._rebuildAllInstances();

    // ── Water plane ───────────────────────────────────────────────────────────
    this._buildWaterPlane();

    // ── Rivers ───────────────────────────────────────────────────────────────
    const rivers = generateRivers(this._elevations, this.cols, this.rows, riverCount, seed);
    this._buildRiverGeometry(rivers);

    // ── Camera initial state ─────────────────────────────────────────────────
    const mapW = this.cols * this.hexSize * Math.sqrt(3);
    const mapD = this.rows * this.hexSize * 1.5;
    const dist = Math.max(mapW, mapD) * 0.8;

    this._state = {
      targetX:  cx,
      targetZ:  cz,
      distance: dist,
      pitch:    initialPitch,
    };
    this._applyCameraState();

    // ── DOM events ────────────────────────────────────────────────────────────
    this._bindEvents(container);

    this.render();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /** Return a snapshot of the current camera/view state. */
  getState(): HexMapState {
    return { ...this._state };
  }

  /**
   * Pan the camera target by (dx, dz) world units.
   * Clamped so the target stays over the map.
   */
  pan(dx: number, dz: number): void {
    const mapW = this.cols * this.hexSize * Math.sqrt(3);
    const mapD = this.rows * this.hexSize * 1.5;
    this._state.targetX = Math.max(0, Math.min(mapW, this._state.targetX + dx));
    this._state.targetZ = Math.max(0, Math.min(mapD, this._state.targetZ + dz));
    this._applyCameraState();
    this.render();
  }

  /**
   * Change the camera distance (zoom) by a multiplicative factor.
   * factor > 1 zooms out; 0 < factor < 1 zooms in.
   * Distance is clamped to [minDist, maxDist].
   */
  zoom(factor: number): void {
    const mapD = this.rows * this.hexSize * 1.5;
    const minDist = this.hexSize * 3;
    const maxDist = mapD * 2;
    this._state.distance = Math.max(minDist, Math.min(maxDist, this._state.distance * factor));
    this._applyCameraState();
    this.render();
  }

  /** Increase zoom (pull camera closer to target). */
  zoomIn(step = 0.1): void {
    this.zoom(1 / (1 + step));
  }

  /** Decrease zoom (push camera farther from target). */
  zoomOut(step = 0.1): void {
    this.zoom(1 + step);
  }

  /**
   * Set the camera pitch (vertical tilt) in radians.
   * Clamped to [MIN_PITCH (30°), MAX_PITCH (70°)].
   */
  setPitch(pitch: number): void {
    this._state.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));
    this._applyCameraState();
    this.render();
  }

  /** Return the current pitch in radians. */
  getPitch(): number {
    return this._state.pitch;
  }

  /**
   * Reveal fog-of-war around hex (q, r) with the given radius.
   * Repaints all affected instances.
   */
  revealAt(q: number, r: number, radius = 3): void {
    this.fog.revealAt(q, r, radius);
    this._rebuildAllInstances();
    this.render();
  }

  /**
   * Return the axial coordinate of the hex currently under the mouse,
   * or null if the cursor is outside the map.
   */
  getHoveredCell(): AxialCoord | null {
    return this._hovered ? { ...this._hovered } : null;
  }

  /**
   * Return the elevation tier at hex (q, r), or null if out of bounds.
   */
  getElevationTier(q: number, r: number): ElevationTier | null {
    if (q < 0 || q >= this.cols || r < 0 || r >= this.rows) return null;
    return getElevationTier(this._elevations[r * this.cols + q]);
  }

  /**
   * Notify the map that its container has been resized.
   */
  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /**
   * Render one frame explicitly.
   * Called automatically by the public API methods, and can be called
   * by consumers after external state changes.
   */
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Release all Three.js resources and remove the canvas. */
  dispose(): void {
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    this._unbindEvents();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ─── Private: scene building ─────────────────────────────────────────────

  /**
   * Build a unit hexagonal prism geometry (radius=1, height=1).
   * The prism sits between y = -0.5 and y = +0.5.
   * Instance matrices will translate and scale it appropriately.
   */
  private _buildHexPrismGeometry(): THREE.BufferGeometry {
    const R = 1; // normalised radius – scaled per instance via matrix
    const verts:   number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Pre-compute the 6 corner positions (pointy-top: corner 0 at north / -Z).
    const corners: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 6; i++) {
      const rad = (Math.PI / 180) * (60 * i - 90);
      corners.push({ x: R * Math.cos(rad), z: R * Math.sin(rad) });
    }

    // ── Top face (y = +0.5, normal = [0,1,0]) ───────────────────────────────
    // Fan: vertex 0 = centre, 1..6 = corners.
    verts.push(0, 0.5, 0); normals.push(0, 1, 0);
    for (const c of corners) {
      verts.push(c.x, 0.5, c.z); normals.push(0, 1, 0);
    }
    for (let i = 1; i <= 6; i++) {
      indices.push(0, i, (i % 6) + 1);
    }

    // ── Side faces (6 quads) ─────────────────────────────────────────────────
    const sideBase = 7;
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const c0 = corners[i], c1 = corners[next];

      // Outward normal: rotate the edge direction 90° in XZ.
      const ex = c1.x - c0.x, ez = c1.z - c0.z;
      const len = Math.sqrt(ex * ex + ez * ez);
      const nx = ez / len, nz = -ex / len;

      const vi = sideBase + i * 4;
      // top-left, top-right, bottom-right, bottom-left
      verts.push(c0.x, 0.5, c0.z);  normals.push(nx, 0, nz);
      verts.push(c1.x, 0.5, c1.z);  normals.push(nx, 0, nz);
      verts.push(c1.x, -0.5, c1.z); normals.push(nx, 0, nz);
      verts.push(c0.x, -0.5, c0.z); normals.push(nx, 0, nz);

      indices.push(vi, vi + 1, vi + 2);
      indices.push(vi, vi + 2, vi + 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,   3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    return geo;
  }

  /** Add a semi-transparent water plane at y = 0 covering the map. */
  private _buildWaterPlane(): void {
    const mapW = this.cols * this.hexSize * Math.sqrt(3) + this.hexSize;
    const mapD = this.rows * this.hexSize * 1.5 + this.hexSize;
    const geo  = new THREE.PlaneGeometry(mapW, mapD);
    const mat  = new THREE.MeshLambertMaterial({
      color:       WATER_COLOR,
      transparent: true,
      opacity:     0.78,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(mapW / 2, -0.02, mapD / 2);
    this.scene.add(plane);
  }

  /** Build the LineSegments geometry for all river edges. */
  private _buildRiverGeometry(rivers: RiverEdge[]): void {
    if (rivers.length === 0) return;

    const positions: number[] = [];
    for (const e of rivers) {
      const { x: ax, z: az } = hexToWorld(e.aq, e.ar, this.hexSize);
      const elevA = this._elevations[e.ar * this.cols + e.aq];
      const elevB = this._elevations[e.br * this.cols + e.bq];
      const yEdge = Math.max(noiseToWorldHeight(elevA), noiseToWorldHeight(elevB)) + 0.08;

      const v0 = hexCornerWorld(ax, az, this.hexSize, e.dir);
      const v1 = hexCornerWorld(ax, az, this.hexSize, (e.dir + 1) % 6);
      positions.push(v0.x, yEdge, v0.z, v1.x, yEdge, v1.z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: RIVER_COLOR, linewidth: 2 });
    this.riverLines = new THREE.LineSegments(geo, mat);
    this.scene.add(this.riverLines);
  }

  // ─── Private: instance update ────────────────────────────────────────────

  /**
   * Set the matrix and colour for every hex instance.
   * Called once during construction and whenever fog state changes.
   */
  private _rebuildAllInstances(): void {
    const dummy    = new THREE.Object3D();
    const color    = new THREE.Color();
    const hexes    = generateRectGrid(this.cols, this.rows);

    for (let i = 0; i < hexes.length; i++) {
      const { q, r } = hexes[i];
      const noiseVal  = this._elevations[r * this.cols + q];
      const worldH    = noiseToWorldHeight(noiseVal);
      const prismH    = Math.max(0.05, worldH + 0.4); // always has some thickness

      const { x, z } = hexToWorld(q, r, this.hexSize);
      const prismCY   = (worldH - prismH) / 2 + prismH / 2; // centre of the prism

      dummy.position.set(x, prismCY, z);
      dummy.scale.set(this.hexSize, prismH, this.hexSize);
      dummy.updateMatrix();
      this.hexMesh.setMatrixAt(i, dummy.matrix);

      // Colour: terrain colour modified by fog state.
      const fogState = this.fog.getState(q, r);
      this._computeInstanceColor(q, r, noiseVal, fogState, color);
      this.hexMesh.setColorAt(i, color);
    }

    this.hexMesh.instanceMatrix.needsUpdate = true;
    if (this.hexMesh.instanceColor) {
      this.hexMesh.instanceColor.needsUpdate = true;
    }
  }

  /** Compute the final THREE.Color for a single hex instance. */
  private _computeInstanceColor(
    _q: number,
    _r: number,
    noiseVal: number,
    fogState: FogState,
    out: THREE.Color,
  ): void {
    if (fogState === FogState.UNCHARTED) {
      out.setRGB(...FOG_UNCHARTED_COLOR);
      return;
    }

    const rawHex = terrainColor(noiseVal);
    out.setHex(rawHex);

    if (fogState === FogState.SHROUD) {
      const hsl = { h: 0, s: 0, l: 0 };
      out.getHSL(hsl);
      out.setHSL(
        hsl.h,
        hsl.s * SHROUD_SATURATION_FACTOR,
        hsl.l * SHROUD_LIGHTNESS_FACTOR,
      );
    }
  }

  // ─── Private: camera ─────────────────────────────────────────────────────

  /** Apply the current `_state` to the Three.js camera. */
  private _applyCameraState(): void {
    const { targetX, targetZ, distance, pitch } = this._state;
    // Camera position: orbit above the target point.
    // pitch = 0 would be horizontal; pitch = π/2 would be straight down.
    const camX = targetX;
    const camY = distance * Math.sin(pitch);
    const camZ = targetZ + distance * Math.cos(pitch);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(targetX, 0, targetZ);
    this.camera.updateProjectionMatrix();
  }

  // ─── Private: hover / raycasting ────────────────────────────────────────

  /**
   * Convert a canvas pixel position to the nearest hex axial coordinate.
   * Returns null if the ray misses the ground plane or the result is
   * outside the grid.
   */
  private _pixelToHex(clientX: number, clientY: number): AxialCoord | null {
    const canvas = this.renderer.domElement;
    const rect   = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left)  / rect.width)  * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;

    const nv = new THREE.Vector2(nx, ny);
    this._raycaster.setFromCamera(nv, this.camera);
    const hit = new THREE.Vector3();
    const didHit = this._raycaster.ray.intersectPlane(this._groundPlane, hit);
    if (!didHit) return null;

    const coord = worldToHex(hit.x, hit.z, this.hexSize);
    if (coord.q < 0 || coord.q >= this.cols || coord.r < 0 || coord.r >= this.rows) {
      return null;
    }
    return coord;
  }

  /** Update hover highlight when the mouse moves. */
  private _onMouseMove = (e: MouseEvent): void => {
    const hex = this._pixelToHex(e.clientX, e.clientY);

    // Clear old hover
    if (this._hovered !== null) {
      const { q, r } = this._hovered;
      const i = r * this.cols + q;
      if (this._hoveredPrevColor) {
        this.hexMesh.setColorAt(i, this._hoveredPrevColor);
        if (this.hexMesh.instanceColor) this.hexMesh.instanceColor.needsUpdate = true;
      }
      this._hovered = null;
      this._hoveredPrevColor = null;
    }

    if (hex) {
      const i = hex.r * this.cols + hex.q;
      const prev = new THREE.Color();
      this.hexMesh.getColorAt(i, prev);
      this._hoveredPrevColor = prev.clone();
      this._hovered = hex;

      // Highlight: brighten the cell.
      const highlight = prev.clone().lerp(new THREE.Color(0xffffff), 0.35);
      this.hexMesh.setColorAt(i, highlight);
      if (this.hexMesh.instanceColor) this.hexMesh.instanceColor.needsUpdate = true;
    }

    this.render();
  };

  // ─── Private: drag pan ───────────────────────────────────────────────────

  private _onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this._dragStart        = { x: e.clientX, y: e.clientY };
    this._dragTargetStart  = { x: this._state.targetX, z: this._state.targetZ };
  };

  private _onMouseDrag = (e: MouseEvent): void => {
    if (!this._dragStart || !this._dragTargetStart) return;

    const canvas = this.renderer.domElement;
    const dx = (e.clientX - this._dragStart.x) / canvas.width;
    const dy = (e.clientY - this._dragStart.y) / canvas.height;

    // Map pixel delta to world delta (approximate: scale by visible distance).
    const scale = this._state.distance * 1.5;
    this._state.targetX = this._dragTargetStart.x - dx * scale;
    this._state.targetZ = this._dragTargetStart.z - dy * scale * Math.sin(this._state.pitch);
    this._applyCameraState();
    this.render();
  };

  private _onMouseUp = (_e: MouseEvent): void => {
    this._dragStart       = null;
    this._dragTargetStart = null;
  };

  // ─── Private: scroll zoom ────────────────────────────────────────────────

  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    this.zoom(factor);
  };

  // ─── Private: event binding ──────────────────────────────────────────────

  private _boundHandlers: Array<{ el: EventTarget; type: string; fn: EventListener }> = [];

  private _bindEvents(container: HTMLElement): void {
    const canvas = this.renderer.domElement;

    const add = (
      el: EventTarget,
      type: string,
      fn: (e: Event) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      el.addEventListener(type, fn as EventListener, opts);
      this._boundHandlers.push({ el, type, fn: fn as EventListener });
    };

    add(canvas, 'mousemove', this._onMouseMove as (e: Event) => void);
    add(canvas, 'mousedown', this._onMouseDown as (e: Event) => void);
    add(container, 'mousemove', this._onMouseDrag as (e: Event) => void);
    add(container, 'mouseup',   this._onMouseUp   as (e: Event) => void);
    add(canvas, 'wheel', this._onWheel as (e: Event) => void, { passive: false });
  }

  private _unbindEvents(): void {
    for (const { el, type, fn } of this._boundHandlers) {
      el.removeEventListener(type, fn);
    }
    this._boundHandlers = [];
  }
}
