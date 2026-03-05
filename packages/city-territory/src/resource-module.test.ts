import { describe, it, expect } from 'vitest';
import { SeedSystem } from './seed-system';
import {
  ResourceModule,
  DEFAULT_PROTOTYPES,
  DEFAULT_MAX_SCORE,
} from './resource-module';

describe('ResourceModule', () => {
  describe('constructor', () => {
    it('should use default prototypes and maxScore when no config provided', () => {
      const mod = new ResourceModule();
      expect(mod.prototypes).toEqual(DEFAULT_PROTOTYPES);
      expect(mod.maxScore).toBe(DEFAULT_MAX_SCORE);
    });

    it('should accept custom prototypes', () => {
      const protos = [{ name: 'Iron', score: 4 }];
      const mod = new ResourceModule({ prototypes: protos });
      expect(mod.prototypes).toEqual(protos);
      expect(mod.maxScore).toBe(DEFAULT_MAX_SCORE);
    });

    it('should accept custom maxScore', () => {
      const mod = new ResourceModule({ maxScore: 20 });
      expect(mod.maxScore).toBe(20);
    });
  });

  describe('generateForTile', () => {
    it('should always produce at least one resource (score > 0)', () => {
      const mod = new ResourceModule();
      for (let i = 0; i < 200; i++) {
        const rng = new SeedSystem(`tile-${i}`);
        const data = mod.generateForTile(rng);
        expect(data.resources.length).toBeGreaterThanOrEqual(1);
        expect(data.totalScore).toBeGreaterThan(0);
      }
    });

    it('should never exceed the maxScore', () => {
      const mod = new ResourceModule();
      for (let i = 0; i < 200; i++) {
        const rng = new SeedSystem(`max-${i}`);
        const data = mod.generateForTile(rng);
        expect(data.totalScore).toBeLessThanOrEqual(mod.maxScore);
      }
    });

    it('should produce deterministic results for the same seed', () => {
      const mod = new ResourceModule();
      const a = mod.generateForTile(new SeedSystem('det'));
      const b = mod.generateForTile(new SeedSystem('det'));
      expect(a).toEqual(b);
    });

    it('should totalScore equal the sum of individual scores', () => {
      const mod = new ResourceModule();
      const rng = new SeedSystem('sum-check');
      const data = mod.generateForTile(rng);
      const sum = data.resources.reduce((s, r) => s + r.score, 0);
      expect(data.totalScore).toBe(sum);
    });

    it('should only contain resources from the configured prototypes', () => {
      const protos = [
        { name: 'A', score: 2 },
        { name: 'B', score: 3 },
      ];
      const mod = new ResourceModule({ prototypes: protos, maxScore: 10 });
      const names = new Set(protos.map(p => p.name));
      for (let i = 0; i < 100; i++) {
        const rng = new SeedSystem(`proto-${i}`);
        const data = mod.generateForTile(rng);
        for (const r of data.resources) {
          expect(names.has(r.name)).toBe(true);
        }
      }
    });

    it('should allow duplicate resource types on a tile', () => {
      // With only one prototype, all resources must be the same type.
      const mod = new ResourceModule({
        prototypes: [{ name: 'Grain', score: 2 }],
        maxScore: 10,
      });
      const rng = new SeedSystem('dup');
      const data = mod.generateForTile(rng);
      expect(data.resources.length).toBeGreaterThan(1);
      expect(data.resources.every(r => r.name === 'Grain')).toBe(true);
    });

    it('should return empty resources when no prototype fits within maxScore', () => {
      const mod = new ResourceModule({
        prototypes: [{ name: 'Huge', score: 100 }],
        maxScore: 10,
      });
      const rng = new SeedSystem('no-fit');
      const data = mod.generateForTile(rng);
      expect(data.resources).toHaveLength(0);
      expect(data.totalScore).toBe(0);
    });

    it('should fill as much as possible without exceeding maxScore', () => {
      // maxScore = 6 with score-2 items → should always get 3 items = 6 total.
      const mod = new ResourceModule({
        prototypes: [{ name: 'X', score: 2 }],
        maxScore: 6,
      });
      const rng = new SeedSystem('fill');
      const data = mod.generateForTile(rng);
      expect(data.totalScore).toBe(6);
      expect(data.resources).toHaveLength(3);
    });
  });

  describe('generateForGrid', () => {
    it('should generate resources for every tile in the grid', () => {
      const mod = new ResourceModule();
      const grid = mod.generateForGrid('world-1', 3, 4);
      expect(grid.size).toBe(12); // 3 * 4
      for (let y = 1; y <= 4; y++) {
        for (let x = 1; x <= 3; x++) {
          expect(grid.has(`${x},${y}`)).toBe(true);
        }
      }
    });

    it('should be deterministic for the same seed', () => {
      const mod = new ResourceModule();
      const a = mod.generateForGrid('same-seed', 5, 5);
      const b = mod.generateForGrid('same-seed', 5, 5);
      for (const [key, value] of a) {
        expect(b.get(key)).toEqual(value);
      }
    });

    it('should produce different results for different seeds', () => {
      const mod = new ResourceModule();
      const a = mod.generateForGrid('seed-A', 5, 5);
      const b = mod.generateForGrid('seed-B', 5, 5);
      // At least some tiles should differ
      let diffCount = 0;
      for (const [key, value] of a) {
        const other = b.get(key);
        if (JSON.stringify(value) !== JSON.stringify(other)) {
          diffCount++;
        }
      }
      expect(diffCount).toBeGreaterThan(0);
    });

    it('should respect maxScore for every tile in the grid', () => {
      const mod = new ResourceModule({ maxScore: 8 });
      const grid = mod.generateForGrid('grid-max', 10, 10);
      for (const data of grid.values()) {
        expect(data.totalScore).toBeLessThanOrEqual(8);
        expect(data.totalScore).toBeGreaterThan(0);
      }
    });
  });
});
