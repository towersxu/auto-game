import { describe, it, expect, beforeEach } from 'vitest';
import { Storage } from './storage';

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

describe('Storage', () => {
  let storage: Storage;
  let mockBackend: MockStorage;

  beforeEach(() => {
    mockBackend = new MockStorage();
    storage = new Storage('test:', mockBackend);
  });

  describe('get', () => {
    it('should return null when key does not exist', () => {
      expect(storage.get('nonexistent')).toBeNull();
    });

    it('should return parsed value when key exists', () => {
      mockBackend.setItem('test:key', JSON.stringify({ foo: 'bar' }));
      expect(storage.get('key')).toEqual({ foo: 'bar' });
    });

    it('should return null for invalid JSON', () => {
      mockBackend.setItem('test:invalid', 'not valid json');
      expect(storage.get('invalid')).toBeNull();
    });
  });

  describe('set', () => {
    it('should store value as JSON string', () => {
      storage.set('key', { data: 'value' });
      expect(mockBackend.getItem('test:key')).toBe('{"data":"value"}');
    });

    it('should overwrite existing value', () => {
      storage.set('key', 'first');
      storage.set('key', 'second');
      expect(storage.get('key')).toBe('second');
    });
  });

  describe('remove', () => {
    it('should remove item from storage', () => {
      storage.set('key', 'value');
      storage.remove('key');
      expect(mockBackend.getItem('test:key')).toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove all items with prefix', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      mockBackend.setItem('other:key', 'other value');
      
      storage.clear();
      
      expect(mockBackend.getItem('test:key1')).toBeNull();
      expect(mockBackend.getItem('test:key2')).toBeNull();
      expect(mockBackend.getItem('other:key')).toBe('other value');
    });
  });

  describe('default prefix', () => {
    it('should use default prefix when not specified', () => {
      const defaultStorage = new Storage('auto-game:', mockBackend);
      defaultStorage.set('key', 'value');
      expect(mockBackend.getItem('auto-game:key')).toBe('"value"');
    });
  });
});
