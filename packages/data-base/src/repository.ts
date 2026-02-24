import { Storage } from './storage';

export interface Repository<T> {
  findById(id: string): T | null;
  findAll(): T[];
  save(entity: T): void;
  delete(id: string): void;
}

export abstract class BaseRepository<T extends { id: string }> implements Repository<T> {
  protected storage: Storage;
  protected storageKey: string;

  constructor(storage: Storage, storageKey: string) {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  findById(id: string): T | null {
    const allRecords = this.findAll();
    return allRecords.find(record => record.id === id) || null;
  }

  findAll(): T[] {
    return this.storage.get<T[]>(this.storageKey) || [];
  }

  save(entity: T): void {
    const allRecords = this.findAll();
    const existingIndex = allRecords.findIndex(record => record.id === entity.id);
    if (existingIndex >= 0) {
      allRecords[existingIndex] = entity;
    } else {
      allRecords.push(entity);
    }
    this.storage.set(this.storageKey, allRecords);
  }

  delete(id: string): void {
    const allRecords = this.findAll();
    const remainingRecords = allRecords.filter(record => record.id !== id);
    this.storage.set(this.storageKey, remainingRecords);
  }
}
