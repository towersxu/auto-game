/**
 * Coordinate System Usage Examples
 * 
 * This file demonstrates how to use the coordinate system API
 * as specified in the task requirements.
 */

import {
  CHUNK_SIZE,
  Chunk,
  ChunkManager,
  ChunkEntity,
  getChunkCoords,
  getLocalCoords,
  getChunkKey,
  SerializedChunk,
} from '../src/coordinate-system';

// ============================================================================
// Example 1: Coordinate Conversion Functions
// ============================================================================

console.log('=== Example 1: Coordinate Conversion ===\n');

// Test world to chunk conversion
console.log('World to Chunk Coordinates (CHUNK_SIZE = 16):');
console.log(`getChunkCoords(0, 0) =`, getChunkCoords(0, 0));      // { cx: 0, cy: 0 }
console.log(`getChunkCoords(15, 0) =`, getChunkCoords(15, 0));    // { cx: 0, cy: 0 }
console.log(`getChunkCoords(16, 0) =`, getChunkCoords(16, 0));    // { cx: 1, cy: 0 }
console.log(`getChunkCoords(-1, 0) =`, getChunkCoords(-1, 0));    // { cx: -1, cy: 0 }
console.log(`getChunkCoords(-16, 0) =`, getChunkCoords(-16, 0));  // { cx: -1, cy: 0 }
console.log(`getChunkCoords(-17, 0) =`, getChunkCoords(-17, 0));  // { cx: -2, cy: 0 }

// Test world to local conversion
console.log('\nWorld to Local Coordinates (CHUNK_SIZE = 16):');
console.log(`getLocalCoords(0, 0) =`, getLocalCoords(0, 0));      // { lx: 0, ly: 0 }
console.log(`getLocalCoords(15, 0) =`, getLocalCoords(15, 0));    // { lx: 15, ly: 0 }
console.log(`getLocalCoords(16, 0) =`, getLocalCoords(16, 0));    // { lx: 0, ly: 0 }
console.log(`getLocalCoords(-1, 0) =`, getLocalCoords(-1, 0));    // { lx: 15, ly: 0 }
console.log(`getLocalCoords(-16, 0) =`, getLocalCoords(-16, 0));  // { lx: 0, ly: 0 }
console.log(`getLocalCoords(-17, 0) =`, getLocalCoords(-17, 0));  // { lx: 15, ly: 0 }

// Test chunk key generation
console.log('\nChunk Key Generation:');
console.log(`getChunkKey(0, 0) = "${getChunkKey(0, 0)}"`);        // "0:0"
console.log(`getChunkKey(-1, 2) = "${getChunkKey(-1, 2)}"`);      // "-1:2"

// ============================================================================
// Example 2: Chunk Management
// ============================================================================

console.log('\n\n=== Example 2: ChunkManager Usage ===\n');

const manager = new ChunkManager();

// Initialize with player position and view radius
manager.initialize(0, 0, 32);
console.log('Initialized ChunkManager at (0, 0) with view radius 32');

// Register entities
manager.registerEntity('player1', 10, 10);
manager.registerEntity('enemy1', 20, 20);
manager.registerEntity('item1', 15, 15);
console.log('\nRegistered 3 entities at positions:');
console.log(`  player1: (10, 10)`);
console.log(`  enemy1: (20, 20)`);
console.log(`  item1: (15, 15)`);

// Demonstrate cross-boundary movement
console.log('\n=== Cross-boundary Movement Demo ===');
console.log(`Moving player1 from (15, 0) to (16, 0) crosses chunk boundary:`);

manager.registerEntity('player1', 15, 0);
const chunkBefore = getChunkCoords(15, 0);
console.log(`  Before: World(15, 0) -> Chunk(${chunkBefore.cx}, ${chunkBefore.cy})`);

manager.moveEntity('player1', 16, 0);
const chunkAfter = getChunkCoords(16, 0);
console.log(`  After: World(16, 0) -> Chunk(${chunkAfter.cx}, ${chunkAfter.cy})`);

// ============================================================================
// Example 3: Required API Functions
// ============================================================================

console.log('\n\n=== Example 3: Required API Functions ===\n');

// 3.1 moveEntity(entityId, targetGridX, targetGridY)
console.log('API: moveEntity(entityId, targetGridX, targetGridY)');
manager.registerEntity('npc1', 0, 0);
console.log(`  Registered npc1 at (0, 0)`);
const moveSuccess = manager.moveEntity('npc1', 50, 50);
console.log(`  moveEntity('npc1', 50, 50) -> ${moveSuccess ? 'success' : 'failed'}`);
const newPos = manager.getEntityPosition('npc1');
console.log(`  New position: (${newPos?.x}, ${newPos?.y})`);

// 3.2 getVisibleChunks(centerX, centerY, radius)
console.log('\nAPI: getVisibleChunks(centerX, centerY, radius)');
const visibleChunks = manager.getVisibleChunks(0, 0, 32);
console.log(`  getVisibleChunks(0, 0, 32) returns ${visibleChunks.length} chunks:`);
visibleChunks.forEach(chunk => {
  console.log(`    - Chunk(${chunk.cx}, ${chunk.cy}) with ${chunk.getAllEntities().length} entities`);
});

// 3.3 serializeChunk(cx, cy)
console.log('\nAPI: serializeChunk(cx, cy)');

// Add some data to chunk (0, 0) first
const chunk00 = manager.getChunk(0, 0);
if (chunk00) {
  chunk00.setTile(0, 0, 1);  // Set tile at local (0, 0) to type 1
  chunk00.setTile(1, 0, 2);  // Set tile at local (1, 0) to type 2
}

const serialized = manager.serializeChunk(0, 0);
console.log(`  serializeChunk(0, 0) returns JSON string:`);
if (serialized) {
  const parsed = JSON.parse(serialized) as SerializedChunk;
  console.log(`    chunkId: "${parsed.chunkId}"`);
  console.log(`    cx: ${parsed.cx}, cy: ${parsed.cy}`);
  console.log(`    staticTiles length: ${parsed.staticTiles.length}`);
  console.log(`    dynamicEntities count: ${parsed.dynamicEntities.length}`);
}

// ============================================================================
// Example 4: Chunk Lifecycle and Persistence
// ============================================================================

console.log('\n\n=== Example 4: Chunk Lifecycle and Persistence ===\n');

// Demonstrate dirty flag
const testChunk = new Chunk(5, 5);
console.log(`New Chunk(5, 5) dirty status: ${testChunk.isDirty()}`);

testChunk.setTile(0, 0, 1);
console.log(`After setTile(0, 0, 1), dirty status: ${testChunk.isDirty()}`);

testChunk.markClean();
console.log(`After markClean(), dirty status: ${testChunk.isDirty()}`);

// Demonstrate chunk loading/unloading
console.log('\nChunk Loading/Unloading:');
const lifecycleManager = new ChunkManager();
lifecycleManager.initialize(0, 0, 16);
console.log(`  Initial chunks around (0, 0) with radius 16:`);
console.log(`  Active chunks: ${lifecycleManager.getAllActiveChunks().length}`);

// Move to new area
const result = lifecycleManager.updateActiveChunks(100, 100, 16);
console.log(`\n  After moving to (100, 100):`);
console.log(`  Loaded: ${result.loaded.length} chunks`);
console.log(`  Unloaded: ${result.unloaded.length} chunks`);
console.log(`  Active chunks: ${lifecycleManager.getAllActiveChunks().length}`);

// ============================================================================
// Example 5: Serialization/Deserialization
// ============================================================================

console.log('\n\n=== Example 5: Serialization/Deserialization ===\n');

// Create and populate a chunk
const originalChunk = new Chunk(10, 10);
originalChunk.setTile(0, 0, 5);
originalChunk.setTile(5, 5, 10);
originalChunk.addEntity({ id: 'test-entity', x: 160, y: 160, type: 'monster' });

// Serialize
const serializedData = originalChunk.serialize();
console.log('Original chunk serialized:');
console.log(`  chunkId: ${serializedData.chunkId}`);
console.log(`  tiles at (0,0): ${serializedData.staticTiles[0]}, (5,5): ${serializedData.staticTiles[5 * CHUNK_SIZE + 5]}`);
console.log(`  entities: ${serializedData.dynamicEntities.map(e => e.id).join(', ')}`);

// Deserialize
const restoredChunk = Chunk.deserialize(serializedData);
console.log('\nRestored chunk:');
console.log(`  chunkId: ${restoredChunk.chunkId}`);
console.log(`  tiles at (0,0): ${restoredChunk.getTile(0, 0)}, (5,5): ${restoredChunk.getTile(5, 5)}`);
console.log(`  entities: ${restoredChunk.getAllEntities().map(e => e.id).join(', ')}`);
console.log(`  dirty status: ${restoredChunk.isDirty()} (should be false after deserialization)`);

// ============================================================================
// Example 6: Negative Coordinate Handling
// ============================================================================

console.log('\n\n=== Example 6: Negative Coordinate Handling ===\n');

console.log('Testing negative coordinates (CHUNK_SIZE = 16):');
const testCases = [
  { x: -1, y: -1 },
  { x: -16, y: -16 },
  { x: -17, y: -17 },
  { x: -32, y: 0 },
];

testCases.forEach(({ x, y }) => {
  const chunk = getChunkCoords(x, y);
  const local = getLocalCoords(x, y);
  console.log(`  World(${x}, ${y}) -> Chunk(${chunk.cx}, ${chunk.cy}), Local(${local.lx}, ${local.ly})`);
});

console.log('\n=== All Examples Completed ===');
