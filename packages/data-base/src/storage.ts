export type StorageKey = string;

interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  length: number;
  key(index: number): string | null;
  clear(): void;
}

class MemoryStorage implements StorageBackend {
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

function getGlobalStorage(): StorageBackend {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return new MemoryStorage();
}

export class Storage {
  private prefix: string;
  private backend: StorageBackend;

  constructor(prefix: string = 'auto-game:', backend?: StorageBackend) {
    this.prefix = prefix;
    this.backend = backend ?? getGlobalStorage();
  }

  get<T>(key: StorageKey): T | null {
    const value = this.backend.getItem(this.prefix + key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: StorageKey, value: T): void {
    this.backend.setItem(this.prefix + key, JSON.stringify(value));
  }

  remove(key: StorageKey): void {
    this.backend.removeItem(this.prefix + key);
  }

  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < this.backend.length; i++) {
      const key = this.backend.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this.backend.removeItem(key));
  }
}
