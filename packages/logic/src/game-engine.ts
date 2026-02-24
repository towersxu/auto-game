import { GameState } from './game-state';

export interface GameConfig {
  fps: number;
  width: number;
  height: number;
}

export class GameEngine {
  private state: GameState;
  private lastFrameTimestamp = 0;
  private running = false;

  constructor(private config: GameConfig) {
    this.state = new GameState();
  }

  start(): void {
    this.running = true;
    this.lastFrameTimestamp = performance.now();
    this.gameLoop();
  }

  stop(): void {
    this.running = false;
  }

  private gameLoop(): void {
    if (!this.running) return;

    const currentFrameTimestamp = performance.now();
    const deltaTime = currentFrameTimestamp - this.lastFrameTimestamp;

    if (deltaTime >= 1000 / this.config.fps) {
      this.update(deltaTime);
      this.lastFrameTimestamp = currentFrameTimestamp;
    }

    requestAnimationFrame(() => this.gameLoop());
  }

  private update(deltaTime: number): void {
    this.state.update(deltaTime);
  }

  getState(): GameState {
    return this.state;
  }
}
