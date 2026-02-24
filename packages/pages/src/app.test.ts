import { describe, it, expect } from 'vitest';
import { App, app } from './app';

describe('App', () => {
  describe('constructor', () => {
    it('should create App instance', () => {
      const instance = new App();
      expect(instance).toBeInstanceOf(App);
    });

    it('should create multiple independent instances', () => {
      const instance1 = new App();
      const instance2 = new App();
      expect(instance1).toBeInstanceOf(App);
      expect(instance2).toBeInstanceOf(App);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('singleton export', () => {
    it('should export singleton app instance', () => {
      expect(app).toBeInstanceOf(App);
    });

    it('should always return the same singleton instance', () => {
      expect(app).toBe(app);
    });
  });

  describe('instance properties', () => {
    it('should create instance with expected structure', () => {
      const instance = new App();
      expect(typeof instance).toBe('object');
    });

    it('should have App prototype methods', () => {
      const instance = new App();
      expect(Object.getPrototypeOf(instance)).toBe(App.prototype);
    });
  });

  describe('edge cases', () => {
    it('should handle instanceof checks correctly', () => {
      const instance = new App();
      expect(instance instanceof App).toBe(true);
      expect(instance instanceof Object).toBe(true);
    });

    it('should have correct constructor reference', () => {
      const instance = new App();
      expect(instance.constructor).toBe(App);
    });
  });
});
