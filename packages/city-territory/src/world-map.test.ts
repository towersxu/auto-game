import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMap } from './world-map';
import { City } from './city';
import { Coordinate } from './coordinate';

describe('WorldMap', () => {
  let worldMap: WorldMap;

  beforeEach(() => {
    worldMap = new WorldMap(12, 16);
  });

  describe('constructor', () => {
    it('should create map with given dimensions', () => {
      expect(worldMap.width).toBe(12);
      expect(worldMap.height).toBe(16);
    });

    it('should start with an empty occupation map', () => {
      expect(worldMap.occupiedMap.size).toBe(0);
    });

    it('should support various map sizes', () => {
      const small = new WorldMap(5, 5);
      expect(small.width).toBe(5);
      expect(small.height).toBe(5);
    });
  });

  describe('isInBounds', () => {
    it('should return true for corner coordinates', () => {
      expect(worldMap.isInBounds(new Coordinate(1, 1))).toBe(true);
      expect(worldMap.isInBounds(new Coordinate(12, 1))).toBe(true);
      expect(worldMap.isInBounds(new Coordinate(1, 16))).toBe(true);
      expect(worldMap.isInBounds(new Coordinate(12, 16))).toBe(true);
    });

    it('should return true for an interior coordinate', () => {
      expect(worldMap.isInBounds(new Coordinate(6, 8))).toBe(true);
    });

    it('should return false when x is below minimum', () => {
      expect(worldMap.isInBounds(new Coordinate(0, 1))).toBe(false);
    });

    it('should return false when y is below minimum', () => {
      expect(worldMap.isInBounds(new Coordinate(1, 0))).toBe(false);
    });

    it('should return false when x exceeds width', () => {
      expect(worldMap.isInBounds(new Coordinate(13, 1))).toBe(false);
    });

    it('should return false when y exceeds height', () => {
      expect(worldMap.isInBounds(new Coordinate(1, 17))).toBe(false);
    });

    it('should return false for negative coordinates', () => {
      expect(worldMap.isInBounds(new Coordinate(-1, -1))).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should return true for in-bounds unoccupied coordinates', () => {
      expect(worldMap.isAvailable(new Coordinate(1, 1))).toBe(true);
      expect(worldMap.isAvailable(new Coordinate(12, 16))).toBe(true);
    });

    it('should return false for out-of-bounds coordinates', () => {
      expect(worldMap.isAvailable(new Coordinate(0, 0))).toBe(false);
      expect(worldMap.isAvailable(new Coordinate(13, 17))).toBe(false);
    });

    it('should return false for already occupied coordinates', () => {
      const coord = new Coordinate(5, 5);
      const city = new City('c1', 'City 1', worldMap);
      worldMap.registerOccupation(coord, city);
      expect(worldMap.isAvailable(coord)).toBe(false);
    });
  });

  describe('registerOccupation', () => {
    it('should register a city at a valid coordinate', () => {
      const coord = new Coordinate(3, 3);
      const city = new City('c1', 'City 1', worldMap);
      worldMap.registerOccupation(coord, city);
      expect(worldMap.getOccupant(coord)).toBe(city);
      expect(worldMap.occupiedMap.size).toBe(1);
    });

    it('should allow multiple cities to occupy different coordinates', () => {
      const city1 = new City('c1', 'City 1', worldMap);
      const city2 = new City('c2', 'City 2', worldMap);
      worldMap.registerOccupation(new Coordinate(1, 1), city1);
      worldMap.registerOccupation(new Coordinate(2, 2), city2);
      expect(worldMap.occupiedMap.size).toBe(2);
    });

    it('should throw for an out-of-bounds coordinate', () => {
      const coord = new Coordinate(0, 0);
      const city = new City('c1', 'City 1', worldMap);
      expect(() => worldMap.registerOccupation(coord, city)).toThrow();
    });

    it('should throw with a descriptive message', () => {
      const coord = new Coordinate(99, 99);
      const city = new City('c1', 'City 1', worldMap);
      expect(() => worldMap.registerOccupation(coord, city)).toThrow(/out of bounds/);
    });
  });

  describe('getOccupant', () => {
    it('should return undefined for an unoccupied coordinate', () => {
      expect(worldMap.getOccupant(new Coordinate(1, 1))).toBeUndefined();
    });

    it('should return the occupying city', () => {
      const coord = new Coordinate(3, 3);
      const city = new City('c1', 'City 1', worldMap);
      worldMap.registerOccupation(coord, city);
      expect(worldMap.getOccupant(coord)).toBe(city);
    });

    it('should distinguish different coordinates', () => {
      const city1 = new City('c1', 'City 1', worldMap);
      const city2 = new City('c2', 'City 2', worldMap);
      worldMap.registerOccupation(new Coordinate(1, 1), city1);
      worldMap.registerOccupation(new Coordinate(2, 2), city2);
      expect(worldMap.getOccupant(new Coordinate(1, 1))).toBe(city1);
      expect(worldMap.getOccupant(new Coordinate(2, 2))).toBe(city2);
      expect(worldMap.getOccupant(new Coordinate(3, 3))).toBeUndefined();
    });
  });
});
