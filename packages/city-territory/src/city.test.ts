import { describe, it, expect, beforeEach } from 'vitest';
import { City } from './city';
import { WorldMap } from './world-map';
import { Coordinate } from './coordinate';

describe('City', () => {
  let worldMap: WorldMap;

  beforeEach(() => {
    worldMap = new WorldMap(12, 16);
  });

  describe('constructor', () => {
    it('should create a city with given id and name', () => {
      const city = new City('c1', 'City 1', worldMap);
      expect(city.id).toBe('c1');
      expect(city.name).toBe('City 1');
    });

    it('should start with an empty territory list', () => {
      const city = new City('c1', 'City 1', worldMap);
      expect(city.territoryList).toHaveLength(0);
    });
  });

  describe('isAdjacentTo', () => {
    it('should return false when city has no territory', () => {
      const city = new City('c1', 'City 1', worldMap);
      expect(city.isAdjacentTo(new Coordinate(2, 2))).toBe(false);
    });

    it('should return true for all four orthogonal neighbors', () => {
      const city = new City('c1', 'City 1', worldMap);
      city.addArea(new Coordinate(5, 5));
      expect(city.isAdjacentTo(new Coordinate(4, 5))).toBe(true);
      expect(city.isAdjacentTo(new Coordinate(6, 5))).toBe(true);
      expect(city.isAdjacentTo(new Coordinate(5, 4))).toBe(true);
      expect(city.isAdjacentTo(new Coordinate(5, 6))).toBe(true);
    });

    it('should return false for diagonal neighbors', () => {
      const city = new City('c1', 'City 1', worldMap);
      city.addArea(new Coordinate(5, 5));
      expect(city.isAdjacentTo(new Coordinate(4, 4))).toBe(false);
      expect(city.isAdjacentTo(new Coordinate(6, 6))).toBe(false);
    });

    it('should return false for far-away coordinates', () => {
      const city = new City('c1', 'City 1', worldMap);
      city.addArea(new Coordinate(2, 2));
      expect(city.isAdjacentTo(new Coordinate(10, 10))).toBe(false);
    });

    it('should return true when adjacent to any tile in multi-tile territory', () => {
      const city = new City('c1', 'City 1', worldMap);
      city.addArea(new Coordinate(1, 1));
      city.addArea(new Coordinate(1, 2));
      // (2, 2) is adjacent to (1, 2)
      expect(city.isAdjacentTo(new Coordinate(2, 2))).toBe(true);
    });
  });

  describe('addArea', () => {
    it('should add the first territory without an adjacency check', () => {
      const city = new City('c1', 'City 1', worldMap);
      const result = city.addArea(new Coordinate(6, 8));
      expect(result).toBe(true);
      expect(city.territoryList).toHaveLength(1);
    });

    it('should register the occupation on the world map', () => {
      const city = new City('c1', 'City 1', worldMap);
      const coord = new Coordinate(1, 1);
      city.addArea(coord);
      expect(worldMap.getOccupant(coord)).toBe(city);
    });

    it('should add an adjacent tile to an existing territory', () => {
      const city = new City('c1', 'City 1', worldMap);
      city.addArea(new Coordinate(1, 1));
      const result = city.addArea(new Coordinate(1, 2));
      expect(result).toBe(true);
      expect(city.territoryList).toHaveLength(2);
    });

    it('should reject a non-adjacent tile when city has territory', () => {
      const city = new City('c1', 'City 1', worldMap);
      city.addArea(new Coordinate(1, 1));
      const result = city.addArea(new Coordinate(5, 5));
      expect(result).toBe(false);
      expect(city.territoryList).toHaveLength(1);
    });

    it('should reject an already-occupied coordinate', () => {
      const city1 = new City('c1', 'City 1', worldMap);
      const city2 = new City('c2', 'City 2', worldMap);
      city1.addArea(new Coordinate(3, 3));
      const result = city2.addArea(new Coordinate(3, 3));
      expect(result).toBe(false);
      expect(city2.territoryList).toHaveLength(0);
    });

    it('should reject an out-of-bounds coordinate', () => {
      const city = new City('c1', 'City 1', worldMap);
      expect(city.addArea(new Coordinate(0, 0))).toBe(false);
      expect(city.addArea(new Coordinate(13, 1))).toBe(false);
      expect(city.addArea(new Coordinate(1, 17))).toBe(false);
    });

    it('should not modify the territory list when rejected', () => {
      const city = new City('c1', 'City 1', worldMap);
      city.addArea(new Coordinate(1, 1));
      city.addArea(new Coordinate(5, 5)); // rejected
      expect(city.territoryList).toHaveLength(1);
      expect(city.territoryList[0].equals(new Coordinate(1, 1))).toBe(true);
    });

    it('should handle the example from the problem statement', () => {
      const city1 = new City('city1', 'City 1', worldMap);
      const city2 = new City('city2', 'City 2', worldMap);

      // City1: [(1,1), (1,2), (2,2)]
      expect(city1.addArea(new Coordinate(1, 1))).toBe(true);
      expect(city1.addArea(new Coordinate(1, 2))).toBe(true);
      expect(city1.addArea(new Coordinate(2, 2))).toBe(true);
      expect(city1.territoryList).toHaveLength(3);

      // City2: [(12,9),(12,8)]
      expect(city2.addArea(new Coordinate(12, 9))).toBe(true);
      expect(city2.addArea(new Coordinate(12, 8))).toBe(true);
      expect(city2.territoryList).toHaveLength(2);

      // World map should show 5 occupied tiles
      expect(worldMap.occupiedMap.size).toBe(5);
    });
  });
});
