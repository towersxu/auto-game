export type StorageKey = string;

export class Storage {
  private prefix: string;

  constructor(prefix: string = 'auto-game:') {
    this.prefix = prefix;
  }

  get<T>(key: StorageKey): T | null {
    const value = localStorage.getItem(this.prefix + key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: StorageKey, value: T): void {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  remove(key: StorageKey): void {
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}
