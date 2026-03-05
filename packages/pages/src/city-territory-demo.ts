import { GameMap, MapController } from '@auto-game/ui-component';
import { Coordinate, WorldMap, City } from '@auto-game/city-territory';
import type { TileResourceData } from '@auto-game/city-territory';

const mapContainer = document.getElementById('map-container') as HTMLElement;
const controllerWrap = document.getElementById('controller-wrap') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;

// ── Map setup ──────────────────────────────────────────────────────────────────
// Map dimensions: 12 columns × 16 rows (1-indexed territory coordinates).
const GRID_WIDTH = 12;
const GRID_HEIGHT = 16;

const map = new GameMap(mapContainer, {
  gridWidth: GRID_WIDTH,
  gridHeight: GRID_HEIGHT,
  cellSize: 40,
  gridColor: 0x555566,
  groundColor: 0x2a4a35,
});

// Scroll to the top-left so City 1 (at rows 0–1) is immediately visible.
// pan(0, large positive) is clamped to offsetY = 0 (top edge).
map.pan(0, 9999);

// ── Pan/zoom controller ────────────────────────────────────────────────────────
const ctrl = new MapController(controllerWrap, { panStep: 60, zoomStep: 0.15 });
ctrl.attachMap(map);

// ── City territory domain objects ──────────────────────────────────────────────
// The WorldMap uses 1-based coordinate indexing: valid range [1, 12] × [1, 16].
// Use a fixed seed so resource layout is deterministic across page reloads.
const worldMap = new WorldMap(GRID_WIDTH, GRID_HEIGHT, { seed: 'city-territory-demo-seed' });
const city1 = new City('city1', 'City 1', worldMap);
const city2 = new City('city2', 'City 2', worldMap);

// City colours (Three.js hex numbers)
const CITY1_COLOR = 0xff6b35;
const CITY2_COLOR = 0x4ecdc4;

// ── Resource icon mapping ─────────────────────────────────────────────────────
/** Map resource names to emoji icons for display. */
const RESOURCE_ICONS: Record<string, string> = {
  Grain: '\u{1F33E}',   // 🌾
  Forest: '\u{1F332}',  // 🌲
  Gold: '\u{1FA99}',    // 🪙
  Wonder: '\u{1F3DB}',  // 🏛
};

/**
 * Convert a 1-based territory coordinate (x, y) to a 0-based GameMap cell
 * (col, row).
 */
function toCell(x: number, y: number): { col: number; row: number } {
  return { col: x - 1, row: y - 1 };
}

/** Colour a territory tile on the map. */
function paintTile(x: number, y: number, color: number): void {
  const { col, row } = toCell(x, y);
  map.setCellColor(col, row, color);
}

/** Render resource icons and score label on a tile. */
function paintResources(x: number, y: number, data: TileResourceData): void {
  const { col, row } = toCell(x, y);
  const icons = data.resources.map(r => RESOURCE_ICONS[r.name] ?? '?');
  map.setCellLabel(col, row, String(data.totalScore), icons);
}

// ── Paint resource labels on every tile ────────────────────────────────────────
for (let y = 1; y <= GRID_HEIGHT; y++) {
  for (let x = 1; x <= GRID_WIDTH; x++) {
    const coord = new Coordinate(x, y);
    const resData = worldMap.getResources(coord);
    if (resData) {
      paintResources(x, y, resData);
    }
  }
}

// ── Initialise City 1: coordinates (1,1), (1,2), (2,2) ───────────────────────
for (const [x, y] of [[1, 1], [1, 2], [2, 2]] as [number, number][]) {
  city1.addArea(new Coordinate(x, y));
  paintTile(x, y, CITY1_COLOR);
}

// ── Initialise City 2: coordinates (12,9), (12,8) ────────────────────────────
for (const [x, y] of [[12, 9], [12, 8]] as [number, number][]) {
  city2.addArea(new Coordinate(x, y));
  paintTile(x, y, CITY2_COLOR);
}

// ── Click handler ──────────────────────────────────────────────────────────────
map.onCellClick((col, row) => {
  // Convert 0-based GameMap cell back to 1-based territory coordinate
  const coord = new Coordinate(col + 1, row + 1);
  const resData = worldMap.getResources(coord);
  const resInfo = resData
    ? ` | 资源: ${resData.resources.map(r => r.name).join(', ')} (${resData.totalScore}分)`
    : '';

  if (!worldMap.isAvailable(coord)) {
    const occupant = worldMap.getOccupant(coord);
    statusEl.textContent = `(${coord.x}, ${coord.y}) 已被 ${occupant?.name ?? '未知城市'} 占领${resInfo}`;
    return;
  }

  if (city1.isAdjacentTo(coord)) {
    city1.addArea(coord);
    paintTile(coord.x, coord.y, CITY1_COLOR);
    statusEl.textContent = `\u2713 (${coord.x}, ${coord.y}) 并入 City 1！${resInfo}`;
    return;
  }

  if (city2.isAdjacentTo(coord)) {
    city2.addArea(coord);
    paintTile(coord.x, coord.y, CITY2_COLOR);
    statusEl.textContent = `\u2713 (${coord.x}, ${coord.y}) 并入 City 2！${resInfo}`;
    return;
  }

  statusEl.textContent = `(${coord.x}, ${coord.y}) 与任何城市不相邻${resInfo}`;
});

// ── Keep canvas filling the container on resize ────────────────────────────────
window.addEventListener('resize', () => {
  map.resize(mapContainer.clientWidth, mapContainer.clientHeight);
});
