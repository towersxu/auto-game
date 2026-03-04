/**
 * hex-demo.ts – entry point for the hexagonal map demo page.
 *
 * Wires together:
 *  - HexMap (renders the hex grid, terrain, rivers, fog-of-war)
 *  - Controller UI (pan, zoom, pitch, reveal-fog buttons)
 *  - HUD overlay (hovered cell info)
 */
import { HexMap, ElevationTier, FogState } from '@auto-game/ui-component';

// ── Initialise map ────────────────────────────────────────────────────────────

const mapContainer = document.getElementById('map-container') as HTMLElement;

const map = new HexMap(mapContainer, {
  cols:        60,
  rows:        60,
  hexSize:     1,
  seed:        2025,
  riverCount:  8,
  revealAll:   false,
});

// Keep canvas filling the container on browser resize.
window.addEventListener('resize', () => {
  map.resize(mapContainer.clientWidth, mapContainer.clientHeight);
});

// ── HUD updates ───────────────────────────────────────────────────────────────

const hudCell = document.getElementById('hud-cell') as HTMLElement;
const hudTier = document.getElementById('hud-tier') as HTMLElement;
const hudFog  = document.getElementById('hud-fog')  as HTMLElement;

const TIER_NAMES: Record<number, string> = {
  [ElevationTier.SUBMERGED]: '🌊 水下层',
  [ElevationTier.BASELAND]:  '🌿 平原层',
  [ElevationTier.ELEVATED]:  '⛰ 丘陵层',
  [ElevationTier.PEAK]:      '🏔 山脉层',
};
const FOG_NAMES: Record<number, string> = {
  [FogState.UNCHARTED]: '⬛ 未探索',
  [FogState.SHROUD]:    '🌫 遮蔽',
  [FogState.VISIBLE]:   '✅ 可见',
};

// Poll the hovered cell at ~30 fps to update the HUD.
setInterval(() => {
  const cell = map.getHoveredCell();
  if (!cell) {
    hudCell.textContent = '—';
    hudTier.textContent = '—';
    hudFog.textContent  = '—';
    return;
  }
  hudCell.textContent = `(q=${cell.q}, r=${cell.r})`;
  const tier = map.getElevationTier(cell.q, cell.r);
  hudTier.textContent = tier !== null ? (TIER_NAMES[tier] ?? '—') : '—';
  hudFog.textContent  = FOG_NAMES[map.fog.getState(cell.q, cell.r)] ?? '—';
}, 33);

// ── Controller buttons ────────────────────────────────────────────────────────

const PAN  = 5;   // world units per button press
const ZOOM = 0.15;

const btnDefs: Array<{ label: string; title: string; col: number; row: number; action: () => void }> = [
  { label: '⊿', title: 'Tilt more',  col: 1, row: 1, action: () => map.setPitch(map.getPitch() + 0.1) },
  { label: '↑', title: 'Pan north',  col: 2, row: 1, action: () => map.pan(0, -PAN) },
  { label: '⊞', title: 'Tilt less',  col: 3, row: 1, action: () => map.setPitch(map.getPitch() - 0.1) },
  { label: '←', title: 'Pan west',   col: 1, row: 2, action: () => map.pan(-PAN, 0) },
  { label: '⊙', title: 'Reset view', col: 2, row: 2, action: () => resetView() },
  { label: '→', title: 'Pan east',   col: 3, row: 2, action: () => map.pan(PAN, 0) },
  { label: '+', title: 'Zoom in',    col: 1, row: 3, action: () => map.zoomIn(ZOOM) },
  { label: '↓', title: 'Pan south',  col: 2, row: 3, action: () => map.pan(0, PAN) },
  { label: '−', title: 'Zoom out',   col: 3, row: 3, action: () => map.zoomOut(ZOOM) },
];

const ctrlGrid = document.getElementById('ctrl-grid') as HTMLElement;
for (const b of btnDefs) {
  const btn = document.createElement('button');
  btn.textContent = b.label;
  btn.title       = b.title;
  btn.className   = 'ctrl-btn';
  btn.style.gridColumn = String(b.col);
  btn.style.gridRow    = String(b.row);
  btn.addEventListener('click', b.action);
  ctrlGrid.appendChild(btn);
}

function resetView(): void {
  const cx = map.cols * map.hexSize * Math.sqrt(3) / 2;
  const cz = map.rows * map.hexSize * 1.5 / 2;
  // Re-pan to centre (can't easily reset distance here without access to internals)
  const state = map.getState();
  map.pan(cx - state.targetX, cz - state.targetZ);
}

// ── Fog-reveal buttons ────────────────────────────────────────────────────────

// "揭开迷雾" – reveal a 5-hex-radius circle in the map centre
document.getElementById('btn-reveal')?.addEventListener('click', () => {
  const cq = Math.floor(map.cols / 2);
  const cr = Math.floor(map.rows / 2);
  map.revealAt(cq, cr, 5);
});

// "显示全图"
document.getElementById('btn-reveal-all')?.addEventListener('click', () => {
  map.fog.revealAll();
  // Force re-render by revealing again (triggers instance rebuild internally)
  map.revealAt(0, 0, 0);
});
