import { describe, it, expect } from 'vitest';
import * as index from './index';
import {
  CHUNK_SIZE,
  getChunkCoords,
  getLocalCoords,
  getChunkKey,
  Chunk,
  ChunkManager,
} from './coordinate-system';

describe('logic index', () => {
  it('should export CHUNK_SIZE constant', () => {
    expect(index.CHUNK_SIZE).toBe(CHUNK_SIZE);
    expect(index.CHUNK_SIZE).toBe(16);
  });

  it('should export getChunkCoords function', () => {
    expect(typeof index.getChunkCoords).toBe('function');
    expect(index.getChunkCoords(0, 0)).toEqual({ cx: 0, cy: 0 });
  });

  it('should export getLocalCoords function', () => {
    expect(typeof index.getLocalCoords).toBe('function');
    expect(index.getLocalCoords(0, 0)).toEqual({ lx: 0, ly: 0 });
  });

  it('should export getChunkKey function', () => {
    expect(typeof index.getChunkKey).toBe('function');
    expect(index.getChunkKey(0, 0)).toBe('0:0');
  });

  it('should export Chunk class', () => {
    expect(index.Chunk).toBe(Chunk);
    const chunk = new index.Chunk(0, 0);
    expect(chunk).toBeInstanceOf(Chunk);
  });

  it('should export ChunkManager class', () => {
    expect(index.ChunkManager).toBe(ChunkManager);
    const manager = new index.ChunkManager();
    expect(manager).toBeInstanceOf(ChunkManager);
  });

  it('should export ChunkEntity interface', () => {
    const entity: index.ChunkEntity = { id: 'test', x: 0, y: 0 };
    expect(entity.id).toBe('test');
    expect(entity.x).toBe(0);
    expect(entity.y).toBe(0);
  });

  it('should export SerializedChunk interface', () => {
    const serialized: index.SerializedChunk = {
      chunkId: '0:0',
      cx: 0,
      cy: 0,
      staticTiles: [],
      dynamicEntities: [],
    };
    expect(serialized.chunkId).toBe('0:0');
  });
});
