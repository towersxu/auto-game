import { Storage } from './storage';

export interface Repository<T> {
  findById(id: string): T | null;
  findAll(): T[];
  save(entity: T): void;
  delete(id: string): void;
}

export abstract class BaseRepository<T extends { id: string }> implements Repository<T> {
  protected storage: Storage;
  protected key: string;

  constructor(storage: Storage, key: string) {
    this.storage = storage;
    this.key = key;
  }

  findById(id: string): T | null {
    const all = this.findAll();
    return all.find(e => e.id === id) || null;
  }

  findAll(): T[] {
    return this.storage.get<T[]>(this.key) || [];
  }

  save(entity: T): void {
    const all = this.findAll();
    const index = all.findIndex(e => e.id === entity.id);
    if (index >= 0) {
      all[index] = entity;
    } else {
      all.push(entity);
    }
    this.storage.set(this.key, all);
  }

  delete(id: string): void {
    const all = this.findAll();
    const filtered = all.filter(e => e.id !== id);
    this.storage.set(this.key, filtered);
  }
}
