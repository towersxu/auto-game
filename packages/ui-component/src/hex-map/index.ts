/**
 * Public barrel for the hex-map module.
 * Re-exports all types and classes needed by consumers.
 */

export { HexMap, type HexMapOptions, type HexMapState } from './hex-map.js';
export { FogManager, FogState } from './fog.js';
export {
  getElevationTier,
  terrainColor,
  lerpColor,
  noiseToWorldHeight,
  ElevationTier,
  TIER_THRESHOLDS,
} from './terrain.js';
export {
  hexToWorld,
  worldToHex,
  hexRound,
  hexCornerWorld,
  hexDistance,
  getNeighbors,
  getDirectionIndex,
  generateRectGrid,
  hexesInRadius,
  HEX_DIRECTIONS,
  type AxialCoord,
  type CubeCoord,
} from './hex-grid.js';
export { octaveNoise } from './noise.js';
export { generateRivers, type RiverEdge } from './river.js';
