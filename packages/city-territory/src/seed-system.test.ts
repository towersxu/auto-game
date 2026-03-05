import { describe, it, expect } from 'vitest';
import { SeedSystem } from './seed-system';

describe('SeedSystem', () => {
  describe('determinism', () => {
    it('should produce the same sequence for the same seed', () => {
      const a = new SeedSystem('test-seed');
      const b = new SeedSystem('test-seed');
      for (let i = 0; i < 100; i++) {
        expect(a.nextFloat()).toBe(b.nextFloat());
      }
    });

    it('should produce different sequences for different seeds', () => {
      const a = new SeedSystem('seed-alpha');
      const b = new SeedSystem('seed-beta');
      const valuesA = Array.from({ length: 10 }, () => a.nextFloat());
      const valuesB = Array.from({ length: 10 }, () => b.nextFloat());
      // Extremely unlikely to be identical
      expect(valuesA).not.toEqual(valuesB);
    });
  });

  describe('nextFloat', () => {
    it('should return values in [0, 1)', () => {
      const rng = new SeedSystem('float-test');
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextFloat();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('nextInt', () => {
    it('should return values within [min, max]', () => {
      const rng = new SeedSystem('int-test');
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextInt(1, 6);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    });

    it('should return the same value when min equals max', () => {
      const rng = new SeedSystem('single');
      expect(rng.nextInt(5, 5)).toBe(5);
    });

    it('should be deterministic', () => {
      const a = new SeedSystem('det-int');
      const b = new SeedSystem('det-int');
      for (let i = 0; i < 50; i++) {
        expect(a.nextInt(0, 100)).toBe(b.nextInt(0, 100));
      }
    });
  });

  describe('choice', () => {
    it('should always pick from the given list', () => {
      const rng = new SeedSystem('choice-test');
      const items = ['a', 'b', 'c', 'd'];
      for (let i = 0; i < 100; i++) {
        expect(items).toContain(rng.choice(items));
      }
    });

    it('should throw on an empty list', () => {
      const rng = new SeedSystem('empty');
      expect(() => rng.choice([])).toThrow('Cannot choose from an empty list');
    });

    it('should return the only element for a single-element list', () => {
      const rng = new SeedSystem('single-choice');
      expect(rng.choice([42])).toBe(42);
    });

    it('should be deterministic', () => {
      const a = new SeedSystem('det-choice');
      const b = new SeedSystem('det-choice');
      const items = [10, 20, 30, 40, 50];
      for (let i = 0; i < 50; i++) {
        expect(a.choice(items)).toBe(b.choice(items));
      }
    });
  });

  describe('seed property', () => {
    it('should expose the seed string', () => {
      const rng = new SeedSystem('hello');
      expect(rng.seed).toBe('hello');
    });
  });
});
