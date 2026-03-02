import { describe, it, expect, beforeEach } from 'vitest';
import {
  CHUNK_SIZE,
  getChunkCoords,
  getLocalCoords,
  getChunkKey,
  getDistance,
  Chunk,
  ChunkManager,
  ChunkEntity,
} from './coordinate-system';

describe('Coordinate System', () => {
  describe('Constants', () => {
    it('should have CHUNK_SIZE of 16', () => {
      expect(CHUNK_SIZE).toBe(16);
    });
  });

  describe('getChunkCoords', () => {
    it('should return correct chunk coordinates for positive values', () => {
      expect(getChunkCoords(0, 0)).toEqual({ cx: 0, cy: 0 });
      expect(getChunkCoords(15, 15)).toEqual({ cx: 0, cy: 0 });
      expect(getChunkCoords(16, 16)).toEqual({ cx: 1, cy: 1 });
      expect(getChunkCoords(31, 31)).toEqual({ cx: 1, cy: 1 });
      expect(getChunkCoords(32, 32)).toEqual({ cx: 2, cy: 2 });
    });

    it('should handle negative coordinates correctly', () => {
      expect(getChunkCoords(-1, 0)).toEqual({ cx: -1, cy: 0 });
      expect(getChunkCoords(-16, -16)).toEqual({ cx: -1, cy: -1 });
      expect(getChunkCoords(-17, -17)).toEqual({ cx: -2, cy: -2 });
    });

    it('should handle edge cases at chunk boundaries', () => {
      expect(getChunkCoords(15, 0)).toEqual({ cx: 0, cy: 0 });
      expect(getChunkCoords(16, 0)).toEqual({ cx: 1, cy: 0 });
      expect(getChunkCoords(-16, 0)).toEqual({ cx: -1, cy: 0 });
      expect(getChunkCoords(-17, 0)).toEqual({ cx: -2, cy: 0 });
    });
  });

  describe('getLocalCoords', () => {
    it('should return correct local coordinates for positive values', () => {
      expect(getLocalCoords(0, 0)).toEqual({ lx: 0, ly: 0 });
      expect(getLocalCoords(15, 15)).toEqual({ lx: 15, ly: 15 });
      expect(getLocalCoords(16, 16)).toEqual({ lx: 0, ly: 0 });
      expect(getLocalCoords(31, 31)).toEqual({ lx: 15, ly: 15 });
    });

    it('should handle negative coordinates correctly', () => {
      expect(getLocalCoords(-1, 0)).toEqual({ lx: 15, ly: 0 });
      expect(getLocalCoords(-16, -16)).toEqual({ lx: 0, ly: 0 });
      expect(getLocalCoords(-17, -17)).toEqual({ lx: 15, ly: 15 });
    });
  });

  describe('getChunkKey', () => {
    it('should generate correct chunk keys', () => {
      expect(getChunkKey(0, 0)).toBe('0:0');
      expect(getChunkKey(1, 2)).toBe('1:2');
      expect(getChunkKey(-1, -2)).toBe('-1:-2');
    });
  });

  describe('getDistance', () => {
    it('should return 1 for coordinates [1,1] and [1,0]', () => {
      expect(getDistance(1, 1, 1, 0)).toBe(1);
    });

    it('should return 0 for coordinates [1,1] and [1,1]', () => {
      expect(getDistance(1, 1, 1, 1)).toBe(0);
    });

    it('should return 2 for coordinates [1,1] and [2,2]', () => {
      expect(getDistance(1, 1, 2, 2)).toBe(2);
    });
  });
});

describe('Chunk', () => {
  let chunk: Chunk;

  beforeEach(() => {
    chunk = new Chunk(0, 0);
  });

  describe('constructor', () => {
    it('should create chunk with correct coordinates', () => {
      expect(chunk.cx).toBe(0);
      expect(chunk.cy).toBe(0);
      expect(chunk.chunkId).toBe('0:0');
    });

    it('should create chunk with negative coordinates', () => {
      const negativeChunk = new Chunk(-1, -2);
      expect(negativeChunk.cx).toBe(-1);
      expect(negativeChunk.cy).toBe(-2);
      expect(negativeChunk.chunkId).toBe('-1:-2');
    });
  });

  describe('getTile/setTile', () => {
    it('should set and get tile at valid coordinates', () => {
      chunk.setTile(0, 0, 1);
      expect(chunk.getTile(0, 0)).toBe(1);
    });

    it('should return null for unset tiles', () => {
      expect(chunk.getTile(0, 0)).toBeNull();
    });

    it('should return null for out of bounds coordinates', () => {
      expect(chunk.getTile(-1, 0)).toBeNull();
      expect(chunk.getTile(16, 0)).toBeNull();
      expect(chunk.getTile(0, -1)).toBeNull();
      expect(chunk.getTile(0, 16)).toBeNull();
    });

    it('should ignore out of bounds set operations', () => {
      chunk.setTile(-1, 0, 1);
      chunk.setTile(16, 0, 1);
      expect(chunk.getTile(-1, 0)).toBeNull();
      expect(chunk.getTile(16, 0)).toBeNull();
    });

    it('should mark chunk as dirty when tile is set', () => {
      expect(chunk.isDirty()).toBe(false);
      chunk.setTile(0, 0, 1);
      expect(chunk.isDirty()).toBe(true);
    });
  });

  describe('Entity management', () => {
    const entity: ChunkEntity = { id: 'entity1', x: 0, y: 0 };

    it('should add and get entity', () => {
      chunk.addEntity(entity);
      expect(chunk.getEntity('entity1')).toEqual(entity);
    });

    it('should return all entities', () => {
      chunk.addEntity({ id: 'e1', x: 0, y: 0 });
      chunk.addEntity({ id: 'e2', x: 1, y: 1 });
      const entities = chunk.getAllEntities();
      expect(entities).toHaveLength(2);
      expect(entities.map(e => e.id)).toContain('e1');
      expect(entities.map(e => e.id)).toContain('e2');
    });

    it('should remove entity', () => {
      chunk.addEntity(entity);
      const removed = chunk.removeEntity('entity1');
      expect(removed).toBe(true);
      expect(chunk.getEntity('entity1')).toBeUndefined();
    });

    it('should return false when removing non-existent entity', () => {
      expect(chunk.removeEntity('nonexistent')).toBe(false);
    });

    it('should mark chunk as dirty when entity is added', () => {
      expect(chunk.isDirty()).toBe(false);
      chunk.addEntity(entity);
      expect(chunk.isDirty()).toBe(true);
    });

    it('should mark chunk as dirty when entity is removed', () => {
      chunk.addEntity(entity);
      chunk.markClean();
      chunk.removeEntity('entity1');
      expect(chunk.isDirty()).toBe(true);
    });
  });

  describe('markClean', () => {
    it('should reset dirty flag', () => {
      chunk.setTile(0, 0, 1);
      expect(chunk.isDirty()).toBe(true);
      chunk.markClean();
      expect(chunk.isDirty()).toBe(false);
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize chunk correctly', () => {
      chunk.setTile(0, 0, 1);
      chunk.addEntity({ id: 'e1', x: 5, y: 5 });
      
      const serialized = chunk.serialize();
      
      expect(serialized.chunkId).toBe('0:0');
      expect(serialized.cx).toBe(0);
      expect(serialized.cy).toBe(0);
      expect(serialized.staticTiles).toHaveLength(256);
      expect(serialized.staticTiles[0]).toBe(1);
      expect(serialized.dynamicEntities).toHaveLength(1);
    });

    it('should deserialize chunk correctly', () => {
      chunk.setTile(0, 0, 1);
      chunk.addEntity({ id: 'e1', x: 5, y: 5 });
      
      const serialized = chunk.serialize();
      const restored = Chunk.deserialize(serialized);
      
      expect(restored.cx).toBe(0);
      expect(restored.cy).toBe(0);
      expect(restored.getTile(0, 0)).toBe(1);
      expect(restored.getEntity('e1')).toEqual({ id: 'e1', x: 5, y: 5 });
      expect(restored.isDirty()).toBe(false);
    });
  });
});

describe('ChunkManager', () => {
  let manager: ChunkManager;

  beforeEach(() => {
    manager = new ChunkManager();
  });

  describe('registerEntity', () => {
    it('should register entity at position', () => {
      manager.registerEntity('e1', 0, 0);
      expect(manager.getEntityPosition('e1')).toEqual({ x: 0, y: 0 });
    });

    it('should create chunk when registering entity', () => {
      manager.registerEntity('e1', 0, 0);
      const chunk = manager.getChunk(0, 0);
      expect(chunk).toBeDefined();
      expect(chunk?.getEntity('e1')).toBeDefined();
    });

    it('should move entity from old chunk to new chunk', () => {
      manager.registerEntity('e1', 0, 0);
      manager.registerEntity('e1', 20, 20);
      
      expect(manager.getEntityPosition('e1')).toEqual({ x: 20, y: 20 });
      expect(manager.getChunk(0, 0)?.getEntity('e1')).toBeUndefined();
      expect(manager.getChunk(1, 1)?.getEntity('e1')).toBeDefined();
    });
  });

  describe('moveEntity', () => {
    it('should move entity within same chunk', () => {
      manager.registerEntity('e1', 0, 0);
      const result = manager.moveEntity('e1', 5, 5);
      
      expect(result).toBe(true);
      expect(manager.getEntityPosition('e1')).toEqual({ x: 5, y: 5 });
    });

    it('should move entity across chunks', () => {
      manager.registerEntity('e1', 0, 0);
      const result = manager.moveEntity('e1', 20, 20);
      
      expect(result).toBe(true);
      expect(manager.getEntityPosition('e1')).toEqual({ x: 20, y: 20 });
    });

    it('should return false for unregistered entity', () => {
      const result = manager.moveEntity('nonexistent', 0, 0);
      expect(result).toBe(false);
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from manager and chunk', () => {
      manager.registerEntity('e1', 0, 0);
      const result = manager.removeEntity('e1');
      
      expect(result).toBe(true);
      expect(manager.getEntityPosition('e1')).toBeUndefined();
      expect(manager.getChunk(0, 0)?.getEntity('e1')).toBeUndefined();
    });

    it('should return false for non-existent entity', () => {
      expect(manager.removeEntity('nonexistent')).toBe(false);
    });
  });

  describe('updateActiveChunks', () => {
    it('should load chunks within view radius', () => {
      const result = manager.updateActiveChunks(0, 0, 16);
      
      expect(result.loaded.length).toBeGreaterThan(0);
      expect(result.loaded).toContain('0:0');
    });

    it('should unload chunks outside view radius', () => {
      manager.updateActiveChunks(0, 0, 32);
      const initialChunks = manager.getAllActiveChunks().length;
      
      const result = manager.updateActiveChunks(100, 100, 16);
      
      expect(result.unloaded.length).toBeGreaterThan(0);
      expect(manager.getAllActiveChunks().length).toBeLessThan(initialChunks);
    });
  });

  describe('getVisibleChunks', () => {
    it('should return chunks within radius', () => {
      const chunks = manager.getVisibleChunks(0, 0, 16);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('getAllActiveChunks', () => {
    it('should return empty array initially', () => {
      expect(manager.getAllActiveChunks()).toEqual([]);
    });

    it('should return all active chunks', () => {
      manager.updateActiveChunks(0, 0, 16);
      expect(manager.getAllActiveChunks().length).toBeGreaterThan(0);
    });
  });

  describe('getDirtyChunks', () => {
    it('should return empty array when no chunks are dirty', () => {
      manager.updateActiveChunks(0, 0, 16);
      expect(manager.getDirtyChunks()).toEqual([]);
    });

    it('should return dirty chunks', () => {
      manager.updateActiveChunks(0, 0, 16);
      const chunk = manager.getChunk(0, 0);
      chunk?.setTile(0, 0, 1);
      
      expect(manager.getDirtyChunks()).toHaveLength(1);
    });
  });

  describe('serializeChunk/loadChunk', () => {
    it('should serialize and load chunk', () => {
      manager.updateActiveChunks(0, 0, 16);
      const chunk = manager.getChunk(0, 0);
      chunk?.setTile(0, 0, 1);
      
      const serialized = manager.serializeChunk(0, 0);
      expect(serialized).not.toBeNull();
      
      manager.loadChunk(JSON.parse(serialized!));
      const loadedChunk = manager.getChunk(0, 0);
      expect(loadedChunk?.getTile(0, 0)).toBe(1);
    });

    it('should return null for non-existent chunk', () => {
      expect(manager.serializeChunk(999, 999)).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should load initial chunks around player', () => {
      manager.initialize(0, 0, 16);
      expect(manager.getAllActiveChunks().length).toBeGreaterThan(0);
    });
  });
});
