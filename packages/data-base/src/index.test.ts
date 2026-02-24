import { describe, it, expect } from 'vitest';
import * as index from './index';
import { Storage } from './storage';
import { BaseRepository } from './repository';

describe('data-base index', () => {
  it('should export Storage class', () => {
    expect(index.Storage).toBe(Storage);
  });

  it('should export BaseRepository class', () => {
    expect(index.BaseRepository).toBe(BaseRepository);
  });

  it('should export Repository interface', () => {
    expect(typeof index).toBe('object');
  });
});
