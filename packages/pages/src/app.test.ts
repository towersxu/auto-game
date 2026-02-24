import { describe, it, expect } from 'vitest';
import { App, app } from './app';

describe('App', () => {
  it('should create App instance', () => {
    const instance = new App();
    expect(instance).toBeInstanceOf(App);
  });

  it('should export singleton app instance', () => {
    expect(app).toBeInstanceOf(App);
  });
});
