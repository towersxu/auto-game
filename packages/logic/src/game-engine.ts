import { GameState } from './game-state';

export interface GameConfig {
  fps: number;
  width: number;
  height: number;
}

export class GameEngine {
  private state: GameState;
  private lastTime = 0;
  private running = false;

  constructor(private config: GameConfig) {
    this.state = new GameState();
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private loop(): void {
    if (!this.running) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    if (deltaTime >= 1000 / this.config.fps) {
      this.update(deltaTime);
      this.lastTime = currentTime;
    }

    requestAnimationFrame(() => this.loop());
  }

  private update(deltaTime: number): void {
    this.state.update(deltaTime);
  }

  getState(): GameState {
    return this.state;
  }
}
