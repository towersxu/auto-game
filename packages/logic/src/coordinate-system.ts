/**
 * Coordinate System Module
 * 
 * A pure logic layer coordinate management system for infinite grid worlds.
 * Features efficient memory management (chunk loading/unloading) and data persistence.
 */

/** Chunk size - number of grid cells per chunk side */
export const CHUNK_SIZE = 16;

/** Entity data structure */
export interface ChunkEntity {
  id: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

/** Serialized chunk data structure */
export interface SerializedChunk {
  chunkId: string;
  cx: number;
  cy: number;
  staticTiles: (number | null)[];
  dynamicEntities: ChunkEntity[];
}

/**
 * Convert world coordinates to chunk coordinates
 * Correctly handles negative coordinates
 * 
 * @example
 * getChunkCoords(-1, 0) // returns { cx: -1, cy: 0 } when CHUNK_SIZE=16
 * getChunkCoords(15, 0) // returns { cx: 0, cy: 0 } when CHUNK_SIZE=16
 * getChunkCoords(16, 0) // returns { cx: 1, cy: 0 } when CHUNK_SIZE=16
 */
export function getChunkCoords(x: number, y: number): { cx: number; cy: number } {
  // For negative coordinates, we need to adjust the division
  // Math.floor handles negative numbers correctly for chunk calculation
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  return { cx, cy };
}

/**
 * Convert world coordinates to local coordinates within a chunk
 * Returns relative index (0 ~ CHUNK_SIZE-1)
 * 
 * @example
 * getLocalCoords(-1, 0) // returns { lx: 15, ly: 0 } when CHUNK_SIZE=16
 * getLocalCoords(15, 0) // returns { lx: 15, ly: 0 } when CHUNK_SIZE=16
 * getLocalCoords(16, 0) // returns { lx: 0, ly: 0 } when CHUNK_SIZE=16
 */
export function getLocalCoords(x: number, y: number): { lx: number; ly: number } {
  // Calculate local coordinates using modulo operation
  // The formula ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE handles negative coordinates
  const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return { lx, ly };
}

/**
 * Calculate the distance between two coordinates
 * Distance is the Manhattan distance (horizontal + vertical moves only, no diagonal movement)
 * 
 * @example
 * getDistance(1, 1, 1, 0) // returns 1
 * getDistance(1, 1, 1, 1) // returns 0
 * getDistance(1, 1, 2, 2) // returns 2
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * Generate a unique chunk key from chunk coordinates
 * Used for Map indexing
 */
export function getChunkKey(cx: number, cy: number): string {
  return `${cx}:${cy}`;
}

/**
 * Represents a single chunk in the world
 * Contains static tiles and dynamic entities
 */
export class Chunk {
  /** Chunk coordinates */
  public readonly cx: number;
  public readonly cy: number;
  
  /** Unique chunk identifier */
  public readonly chunkId: string;
  
  /** Static tile data (compressed array) */
  private staticTiles: (number | null)[];
  
  /** Dynamic entities in this chunk */
  private entities: Map<string, ChunkEntity>;
  
  /** Dirty flag - true if chunk has been modified */
  private dirty = false;

  constructor(cx: number, cy: number) {
    this.cx = cx;
    this.cy = cy;
    this.chunkId = getChunkKey(cx, cy);
    this.staticTiles = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(null);
    this.entities = new Map();
  }

  /**
   * Get the static tile at local coordinates
   */
  getTile(lx: number, ly: number): number | null {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE) {
      return null;
    }
    return this.staticTiles[ly * CHUNK_SIZE + lx];
  }

  /**
   * Set the static tile at local coordinates
   */
  setTile(lx: number, ly: number, tileId: number | null): void {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE) {
      return;
    }
    this.staticTiles[ly * CHUNK_SIZE + lx] = tileId;
    this.dirty = true;
  }

  /**
   * Add an entity to this chunk
   */
  addEntity(entity: ChunkEntity): void {
    this.entities.set(entity.id, entity);
    this.dirty = true;
  }

  /**
   * Remove an entity from this chunk
   */
  removeEntity(entityId: string): boolean {
    const removed = this.entities.delete(entityId);
    if (removed) {
      this.dirty = true;
    }
    return removed;
  }

  /**
   * Get an entity by ID
   */
  getEntity(entityId: string): ChunkEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get all entities in this chunk
   */
  getAllEntities(): ChunkEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Check if this chunk has been modified
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Mark chunk as clean (after saving)
   */
  markClean(): void {
    this.dirty = false;
  }

  /**
   * Serialize chunk to JSON structure
   */
  serialize(): SerializedChunk {
    return {
      chunkId: this.chunkId,
      cx: this.cx,
      cy: this.cy,
      staticTiles: [...this.staticTiles],
      dynamicEntities: this.getAllEntities(),
    };
  }

  /**
   * Create a chunk from serialized data
   */
  static deserialize(data: SerializedChunk): Chunk {
    const chunk = new Chunk(data.cx, data.cy);
    chunk.staticTiles = [...data.staticTiles];
    for (const entity of data.dynamicEntities) {
      chunk.entities.set(entity.id, entity);
    }
    chunk.dirty = false;
    return chunk;
  }
}

/**
 * Manages all active chunks and entity positions
 * Handles chunk loading/unloading based on view radius
 */
export class ChunkManager {
  /** Map of active chunks */
  private activeChunks: Map<string, Chunk>;
  
  /** Map of all entity positions (entityId -> world coordinates) */
  private entities: Map<string, { x: number; y: number }>;

  constructor() {
    this.activeChunks = new Map();
    this.entities = new Map();
  }

  /**
   * Register an entity with the manager
   */
  registerEntity(entityId: string, x: number, y: number): void {
    const oldPos = this.entities.get(entityId);
    
    if (oldPos) {
      // Remove from old chunk
      const oldChunkCoords = getChunkCoords(oldPos.x, oldPos.y);
      const oldChunkKey = getChunkKey(oldChunkCoords.cx, oldChunkCoords.cy);
      const oldChunk = this.activeChunks.get(oldChunkKey);
      if (oldChunk) {
        oldChunk.removeEntity(entityId);
      }
    }

    // Update position
    this.entities.set(entityId, { x, y });

    // Add to new chunk
    const newChunkCoords = getChunkCoords(x, y);
    const newChunkKey = getChunkKey(newChunkCoords.cx, newChunkCoords.cy);
    let newChunk = this.activeChunks.get(newChunkKey);
    
    if (!newChunk) {
      newChunk = new Chunk(newChunkCoords.cx, newChunkCoords.cy);
      this.activeChunks.set(newChunkKey, newChunk);
    }
    
    newChunk.addEntity({ id: entityId, x, y });
  }

  /**
   * Move an entity to a new position
   * Handles cross-boundary movement automatically
   */
  moveEntity(entityId: string, targetGridX: number, targetGridY: number): boolean {
    const currentPos = this.entities.get(entityId);
    if (!currentPos) {
      return false;
    }

    const oldChunkCoords = getChunkCoords(currentPos.x, currentPos.y);
    const newChunkCoords = getChunkCoords(targetGridX, targetGridY);

    // Update entity position
    this.entities.set(entityId, { x: targetGridX, y: targetGridY });

    // Check if chunk changed
    if (oldChunkCoords.cx !== newChunkCoords.cx || oldChunkCoords.cy !== newChunkCoords.cy) {
      // Remove from old chunk
      const oldChunkKey = getChunkKey(oldChunkCoords.cx, oldChunkCoords.cy);
      const oldChunk = this.activeChunks.get(oldChunkKey);
      if (oldChunk) {
        oldChunk.removeEntity(entityId);
      }

      // Add to new chunk
      const newChunkKey = getChunkKey(newChunkCoords.cx, newChunkCoords.cy);
      let newChunk = this.activeChunks.get(newChunkKey);
      
      if (!newChunk) {
        newChunk = new Chunk(newChunkCoords.cx, newChunkCoords.cy);
        this.activeChunks.set(newChunkKey, newChunk);
      }
      
      newChunk.addEntity({ id: entityId, x: targetGridX, y: targetGridY });
    } else {
      // Same chunk, just update position
      const chunkKey = getChunkKey(newChunkCoords.cx, newChunkCoords.cy);
      const chunk = this.activeChunks.get(chunkKey);
      if (chunk) {
        const entity = chunk.getEntity(entityId);
        if (entity) {
          entity.x = targetGridX;
          entity.y = targetGridY;
        }
      }
    }

    return true;
  }

  /**
   * Get entity position
   */
  getEntityPosition(entityId: string): { x: number; y: number } | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Remove an entity from the manager
   */
  removeEntity(entityId: string): boolean {
    const pos = this.entities.get(entityId);
    if (pos) {
      const chunkCoords = getChunkCoords(pos.x, pos.y);
      const chunkKey = getChunkKey(chunkCoords.cx, chunkCoords.cy);
      const chunk = this.activeChunks.get(chunkKey);
      if (chunk) {
        chunk.removeEntity(entityId);
      }
    }
    return this.entities.delete(entityId);
  }

  /**
   * Update active chunks based on center point and view radius
   * Loads new chunks and unloads distant chunks
   */
  updateActiveChunks(centerX: number, centerY: number, viewRadius: number): {
    loaded: string[];
    unloaded: string[];
  } {
    const centerChunk = getChunkCoords(centerX, centerY);
    const requiredChunks = new Set<string>();

    // Calculate all chunks within view radius
    const chunkRadius = Math.ceil(viewRadius / CHUNK_SIZE);
    
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      for (let dy = -chunkRadius; dy <= chunkRadius; dy++) {
        const cx = centerChunk.cx + dx;
        const cy = centerChunk.cy + dy;
        const chunkKey = getChunkKey(cx, cy);
        requiredChunks.add(chunkKey);
      }
    }

    // Find chunks to load
    const loaded: string[] = [];
    for (const chunkKey of requiredChunks) {
      if (!this.activeChunks.has(chunkKey)) {
        const [cx, cy] = chunkKey.split(':').map(Number);
        this.activeChunks.set(chunkKey, new Chunk(cx, cy));
        loaded.push(chunkKey);
      }
    }

    // Find chunks to unload
    const unloaded: string[] = [];
    for (const [chunkKey] of this.activeChunks) {
      if (!requiredChunks.has(chunkKey)) {
        // Only unload if not dirty, or persist it first
        this.activeChunks.delete(chunkKey);
        unloaded.push(chunkKey);
      }
    }

    return { loaded, unloaded };
  }

  /**
   * Get all visible chunks based on center point and radius
   */
  getVisibleChunks(centerX: number, centerY: number, radius: number): Chunk[] {
    this.updateActiveChunks(centerX, centerY, radius);
    return Array.from(this.activeChunks.values());
  }

  /**
   * Get a specific chunk by coordinates
   */
  getChunk(cx: number, cy: number): Chunk | undefined {
    return this.activeChunks.get(getChunkKey(cx, cy));
  }

  /**
   * Get all active chunks
   */
  getAllActiveChunks(): Chunk[] {
    return Array.from(this.activeChunks.values());
  }

  /**
   * Get all dirty chunks that need to be persisted
   */
  getDirtyChunks(): Chunk[] {
    return this.getAllActiveChunks().filter(chunk => chunk.isDirty());
  }

  /**
   * Serialize a specific chunk to JSON string
   */
  serializeChunk(cx: number, cy: number): string | null {
    const chunk = this.getChunk(cx, cy);
    if (!chunk) {
      return null;
    }
    return JSON.stringify(chunk.serialize());
  }

  /**
   * Load a chunk from serialized data
   */
  loadChunk(data: SerializedChunk): void {
    const chunk = Chunk.deserialize(data);
    this.activeChunks.set(chunk.chunkId, chunk);
  }

  /**
   * Initialize the manager with player position
   * Loads initial chunks around the player
   */
  initialize(playerX: number, playerY: number, viewRadius: number): void {
    this.updateActiveChunks(playerX, playerY, viewRadius);
  }
}
