import { describe, it, expect } from 'vitest';
import { Coordinate } from './coordinate';

describe('Coordinate', () => {
  describe('constructor', () => {
    it('should create a coordinate with given x and y', () => {
      const coord = new Coordinate(3, 4);
      expect(coord.x).toBe(3);
      expect(coord.y).toBe(4);
    });

    it('should support negative coordinates', () => {
      const coord = new Coordinate(-1, -2);
      expect(coord.x).toBe(-1);
      expect(coord.y).toBe(-2);
    });

    it('should support zero coordinates', () => {
      const coord = new Coordinate(0, 0);
      expect(coord.x).toBe(0);
      expect(coord.y).toBe(0);
    });
  });

  describe('equals', () => {
    it('should return true for equal coordinates', () => {
      const a = new Coordinate(1, 2);
      const b = new Coordinate(1, 2);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false when x differs', () => {
      expect(new Coordinate(1, 2).equals(new Coordinate(2, 2))).toBe(false);
    });

    it('should return false when y differs', () => {
      expect(new Coordinate(1, 2).equals(new Coordinate(1, 3))).toBe(false);
    });

    it('should return false when both differ', () => {
      expect(new Coordinate(1, 2).equals(new Coordinate(3, 4))).toBe(false);
    });
  });

  describe('distanceTo', () => {
    it('should return 0 for the same coordinate', () => {
      const coord = new Coordinate(1, 1);
      expect(coord.distanceTo(new Coordinate(1, 1))).toBe(0);
    });

    it('should return 1 for horizontally adjacent coordinates', () => {
      const coord = new Coordinate(1, 1);
      expect(coord.distanceTo(new Coordinate(2, 1))).toBe(1);
      expect(coord.distanceTo(new Coordinate(0, 1))).toBe(1);
    });

    it('should return 1 for vertically adjacent coordinates', () => {
      const coord = new Coordinate(1, 1);
      expect(coord.distanceTo(new Coordinate(1, 2))).toBe(1);
      expect(coord.distanceTo(new Coordinate(1, 0))).toBe(1);
    });

    it('should calculate Manhattan distance correctly', () => {
      expect(new Coordinate(1, 1).distanceTo(new Coordinate(3, 4))).toBe(5);
      expect(new Coordinate(0, 0).distanceTo(new Coordinate(3, 4))).toBe(7);
    });

    it('should be symmetric', () => {
      const a = new Coordinate(2, 3);
      const b = new Coordinate(5, 1);
      expect(a.distanceTo(b)).toBe(b.distanceTo(a));
    });
  });

  describe('getNeighbors', () => {
    it('should return exactly 4 neighbors', () => {
      const coord = new Coordinate(2, 2);
      expect(coord.getNeighbors()).toHaveLength(4);
    });

    it('should return all 4 orthogonal neighbors', () => {
      const coord = new Coordinate(2, 2);
      const neighbors = coord.getNeighbors();
      expect(neighbors.some(n => n.equals(new Coordinate(1, 2)))).toBe(true);
      expect(neighbors.some(n => n.equals(new Coordinate(3, 2)))).toBe(true);
      expect(neighbors.some(n => n.equals(new Coordinate(2, 1)))).toBe(true);
      expect(neighbors.some(n => n.equals(new Coordinate(2, 3)))).toBe(true);
    });

    it('each neighbor should be distance 1 away', () => {
      const coord = new Coordinate(5, 5);
      for (const neighbor of coord.getNeighbors()) {
        expect(coord.distanceTo(neighbor)).toBe(1);
      }
    });
  });

  describe('toString', () => {
    it('should return comma-separated x,y', () => {
      expect(new Coordinate(1, 2).toString()).toBe('1,2');
    });

    it('should handle negative values', () => {
      expect(new Coordinate(-1, -2).toString()).toBe('-1,-2');
    });

    it('should handle zero', () => {
      expect(new Coordinate(0, 0).toString()).toBe('0,0');
    });
  });

  describe('fromString', () => {
    it('should create coordinate from string', () => {
      const coord = Coordinate.fromString('3,4');
      expect(coord.x).toBe(3);
      expect(coord.y).toBe(4);
    });

    it('should handle negative values', () => {
      const coord = Coordinate.fromString('-1,-2');
      expect(coord.x).toBe(-1);
      expect(coord.y).toBe(-2);
    });

    it('should round-trip through toString', () => {
      const original = new Coordinate(7, 11);
      const restored = Coordinate.fromString(original.toString());
      expect(restored.equals(original)).toBe(true);
    });
  });
});
