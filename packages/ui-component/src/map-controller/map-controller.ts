import { GameMap } from '../map/map';

export interface MapControllerOptions {
  /** Pan step in world units per button press */
  panStep?: number;
  /** Zoom step per button press (fraction of zoom range) */
  zoomStep?: number;
  /** Additional CSS class for the controller container */
  className?: string;
}

/**
 * A gamepad-style controller that provides pan, zoom, and view-angle buttons
 * for a GameMap.
 *
 * Button layout:
 *   Row 1: [ ⊿ Tilt View ] [ ↑  Pan Up   ] [ ⊞ Top Down  ]
 *   Row 2: [ ←  Pan Left ] [ ⊙  Center   ] [ →  Pan Right ]
 *   Row 3: [ +  Zoom In  ] [ ↓  Pan Down  ] [ −  Zoom Out  ]
 */
export class MapController {
  private container: HTMLElement;
  private map: GameMap | null;
  readonly panStep: number;
  readonly zoomStep: number;

  constructor(container: HTMLElement, options: MapControllerOptions = {}) {
    this.container = container;
    this.map = null;
    this.panStep = options.panStep ?? 10;
    this.zoomStep = options.zoomStep ?? 0.1;

    this._buildUI(options.className);
  }

  /** Attach a GameMap instance that will be controlled */
  attachMap(map: GameMap): void {
    this.map = map;
  }

  /** Detach the currently controlled GameMap */
  detachMap(): void {
    this.map = null;
  }

  /** Return the root DOM element of the controller */
  getElement(): HTMLElement {
    return this.container;
  }

  /** Dispose of the controller (removes DOM listeners) */
  dispose(): void {
    this.container.innerHTML = '';
    this.map = null;
  }

  // ─── private ────────────────────────────────────────────────────────────────

  private _buildUI(extraClass?: string): void {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = [
      'map-controller',
      extraClass ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    wrapper.style.cssText = [
      'display:inline-grid',
      'grid-template-columns:repeat(3,40px)',
      'grid-template-rows:repeat(3,40px)',
      'gap:4px',
      'user-select:none',
    ].join(';');

    const buttons: Array<{
      label: string;
      title: string;
      col: number;
      row: number;
      action: () => void;
    }> = [
      // Row 1 – col 1, 2, 3
      {
        label: '⊿',
        title: 'Tilt View',
        col: 1,
        row: 1,
        action: () => this.map?.tiltView(),
      },
      {
        label: '↑',
        title: 'Pan Up',
        col: 2,
        row: 1,
        action: () => this.map?.pan(0, -this.panStep),
      },
      {
        label: '⊞',
        title: 'Top Down',
        col: 3,
        row: 1,
        action: () => this.map?.topDownView(),
      },
      // Row 2 – col 1, 2, 3
      {
        label: '←',
        title: 'Pan Left',
        col: 1,
        row: 2,
        action: () => this.map?.pan(-this.panStep, 0),
      },
      {
        label: '⊙',
        title: 'Center',
        col: 2,
        row: 2,
        action: () => this.map?.center(),
      },
      {
        label: '→',
        title: 'Pan Right',
        col: 3,
        row: 2,
        action: () => this.map?.pan(this.panStep, 0),
      },
      // Row 3 – col 1, 2, 3
      {
        label: '+',
        title: 'Zoom In',
        col: 1,
        row: 3,
        action: () => this.map?.zoomIn(this.zoomStep),
      },
      {
        label: '↓',
        title: 'Pan Down',
        col: 2,
        row: 3,
        action: () => this.map?.pan(0, this.panStep),
      },
      {
        label: '−',
        title: 'Zoom Out',
        col: 3,
        row: 3,
        action: () => this.map?.zoomOut(this.zoomStep),
      },
    ];

    for (const btn of buttons) {
      const el = this._makeButton(btn.label, btn.title, btn.action);
      el.style.gridColumn = String(btn.col);
      el.style.gridRow = String(btn.row);
      wrapper.appendChild(el);
    }

    this.container.appendChild(wrapper);
  }

  private _makeButton(
    label: string,
    title: string,
    action: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.style.cssText = [
      'width:40px',
      'height:40px',
      'font-size:18px',
      'cursor:pointer',
      'border:1px solid #555',
      'border-radius:6px',
      'background:#2d2d2d',
      'color:#fff',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    btn.addEventListener('click', action);
    return btn;
  }
}
