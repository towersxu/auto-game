import { describe, it, expect } from 'vitest';
import * as index from './index';
import { App, app } from './app';

describe('pages index', () => {
  it('should export App class', () => {
    expect(index.App).toBe(App);
  });

  it('should export app singleton instance', () => {
    expect(index.app).toBe(app);
    expect(index.app).toBeInstanceOf(App);
  });

  it('should create App instance from index export', () => {
    const instance = new index.App();
    expect(instance).toBeInstanceOf(App);
  });

  it('should always return the same singleton instance', () => {
    expect(index.app).toBe(index.app);
  });

  it('should allow creating multiple independent instances', () => {
    const instance1 = new index.App();
    const instance2 = new index.App();
    expect(instance1).not.toBe(instance2);
    expect(instance1).toBeInstanceOf(App);
    expect(instance2).toBeInstanceOf(App);
  });
});
