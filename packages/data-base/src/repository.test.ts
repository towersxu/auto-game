import { describe, it, expect, beforeEach } from 'vitest';
import { Storage } from './storage';
import { BaseRepository } from './repository';

interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  length: number;
  key(index: number): string | null;
  clear(): void;
}

class MockStorage implements StorageBackend {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  clear(): void {
    this.data.clear();
  }
}

interface TestEntity {
  id: string;
  name: string;
  value: number;
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor(storage: Storage) {
    super(storage, 'test-entities');
  }
}

describe('BaseRepository', () => {
  let storage: Storage;
  let repository: TestRepository;
  let mockBackend: MockStorage;

  beforeEach(() => {
    mockBackend = new MockStorage();
    storage = new Storage('test:', mockBackend);
    repository = new TestRepository(storage);
  });

  describe('findById', () => {
    it('should return null when entity does not exist', () => {
      expect(repository.findById('nonexistent')).toBeNull();
    });

    it('should return entity when it exists', () => {
      const entity: TestEntity = { id: '1', name: 'Test', value: 42 };
      repository.save(entity);
      expect(repository.findById('1')).toEqual(entity);
    });
  });

  describe('findAll', () => {
    it('should return empty array when no entities exist', () => {
      expect(repository.findAll()).toEqual([]);
    });

    it('should return all saved entities', () => {
      const entity1: TestEntity = { id: '1', name: 'First', value: 1 };
      const entity2: TestEntity = { id: '2', name: 'Second', value: 2 };
      repository.save(entity1);
      repository.save(entity2);
      expect(repository.findAll()).toEqual([entity1, entity2]);
    });
  });

  describe('save', () => {
    it('should add new entity', () => {
      const entity: TestEntity = { id: '1', name: 'Test', value: 42 };
      repository.save(entity);
      expect(repository.findAll()).toHaveLength(1);
    });

    it('should update existing entity', () => {
      const entity: TestEntity = { id: '1', name: 'Test', value: 42 };
      repository.save(entity);
      
      const updated: TestEntity = { id: '1', name: 'Updated', value: 100 };
      repository.save(updated);
      
      expect(repository.findAll()).toHaveLength(1);
      expect(repository.findById('1')).toEqual(updated);
    });

    it('should persist to storage', () => {
      const entity: TestEntity = { id: '1', name: 'Test', value: 42 };
      repository.save(entity);
      
      const newRepository = new TestRepository(storage);
      expect(newRepository.findById('1')).toEqual(entity);
    });
  });

  describe('delete', () => {
    it('should remove entity by id', () => {
      const entity: TestEntity = { id: '1', name: 'Test', value: 42 };
      repository.save(entity);
      repository.delete('1');
      expect(repository.findById('1')).toBeNull();
    });

    it('should do nothing when entity does not exist', () => {
      repository.delete('nonexistent');
      expect(repository.findAll()).toEqual([]);
    });

    it('should only delete specified entity', () => {
      const entity1: TestEntity = { id: '1', name: 'First', value: 1 };
      const entity2: TestEntity = { id: '2', name: 'Second', value: 2 };
      repository.save(entity1);
      repository.save(entity2);
      
      repository.delete('1');
      
      expect(repository.findById('1')).toBeNull();
      expect(repository.findById('2')).toEqual(entity2);
    });
  });
});
