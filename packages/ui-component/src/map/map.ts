import * as THREE from 'three';

export interface MapOptions {
  /** Width of the map in grid cells */
  gridWidth?: number;
  /** Height of the map in grid cells */
  gridHeight?: number;
  /** Size of each grid cell in world units */
  cellSize?: number;
  /** Color of grid lines */
  gridColor?: number;
  /** Color of the map ground */
  groundColor?: number;
}

export interface MapState {
  /** Current pan offset X */
  offsetX: number;
  /** Current pan offset Z */
  offsetZ: number;
  /** Current zoom level (camera distance multiplier) */
  zoom: number;
}

/**
 * A 2D grid map rendered from a 2.5D isometric perspective using Three.js.
 */
export class GameMap {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private gridHelper: THREE.GridHelper;
  private ground: THREE.Mesh;
  private animationId: number | null = null;

  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly cellSize: number;

  private state: MapState;

  constructor(container: HTMLElement, options: MapOptions = {}) {
    this.gridWidth = options.gridWidth ?? 168;
    this.gridHeight = options.gridHeight ?? 168;
    this.cellSize = options.cellSize ?? 1;
    const gridColor = options.gridColor ?? 0x888888;
    const groundColor = options.groundColor ?? 0x4a7c59;

    const mapW = this.gridWidth * this.cellSize;
    const mapH = this.gridHeight * this.cellSize;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(mapW, mapH);
    const groundMat = new THREE.MeshBasicMaterial({ color: groundColor });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    // Grid lines
    const divisions = Math.max(this.gridWidth, this.gridHeight);
    this.gridHelper = new THREE.GridHelper(
      Math.max(mapW, mapH),
      divisions,
      gridColor,
      gridColor
    );
    this.scene.add(this.gridHelper);

    // Isometric camera (2.5D view)
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = Math.max(mapW, mapH) * 0.6;
    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      10000
    );

    // Isometric angle: look at origin from above-and-side
    const camDist = frustumSize;
    this.camera.position.set(camDist, camDist * 0.8, camDist);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.state = { offsetX: 0, offsetZ: 0, zoom: 1 };

    this.render();
  }

  /** Pan the map by delta world units */
  pan(deltaX: number, deltaZ: number): void {
    this.state.offsetX += deltaX;
    this.state.offsetZ += deltaZ;
    this.camera.position.x += deltaX;
    this.camera.position.z += deltaZ;
    this.camera.lookAt(
      this.state.offsetX,
      0,
      this.state.offsetZ
    );
    this.render();
  }

  /** Reset pan and zoom to the initial state */
  center(): void {
    this.state.offsetX = 0;
    this.state.offsetZ = 0;
    this.state.zoom = 1;
    const frustumSize =
      Math.max(this.gridWidth, this.gridHeight) * this.cellSize * 0.6;
    const camDist = frustumSize;
    this.camera.position.set(camDist, camDist * 0.8, camDist);
    this.camera.lookAt(0, 0, 0);
    this._applyZoom();
    this.render();
  }

  /** Zoom in (decrease the orthographic frustum size) */
  zoomIn(factor = 0.1): void {
    this.state.zoom = Math.max(0.1, this.state.zoom - factor);
    this._applyZoom();
    this.render();
  }

  /** Zoom out (increase the orthographic frustum size) */
  zoomOut(factor = 0.1): void {
    this.state.zoom = Math.min(5, this.state.zoom + factor);
    this._applyZoom();
    this.render();
  }

  /** Get a copy of the current map state */
  getState(): MapState {
    return { ...this.state };
  }

  /** Resize the renderer to fit the container */
  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    const aspect = width / height;
    const frustumSize =
      Math.max(this.gridWidth, this.gridHeight) *
      this.cellSize *
      0.6 *
      this.state.zoom;
    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** Render one frame */
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Dispose of all Three.js resources */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.ground.geometry.dispose();
    (this.ground.material as THREE.MeshBasicMaterial).dispose();
    this.renderer.dispose();
  }

  private _applyZoom(): void {
    const frustumSize =
      Math.max(this.gridWidth, this.gridHeight) *
      this.cellSize *
      0.6 *
      this.state.zoom;
    const aspect =
      this.renderer.domElement.clientWidth /
      this.renderer.domElement.clientHeight;
    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }
}
