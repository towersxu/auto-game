import { GameEngine } from '@auto-game/logic';
import { Storage } from '@auto-game/data-base';

export class App {
  private engine: GameEngine | null = null;
  private storage: Storage;

  constructor() {
    this.storage = new Storage('auto-game:');
  }

  start(): void {
    console.log('🎮 Auto Game Started!');
    
    const savedState = this.storage.get<Record<string, unknown>>('game-state');
    if (savedState) {
      console.log('Loaded saved state:', savedState);
    }

    this.engine = new GameEngine({
      fps: 60,
      width: 800,
      height: 600
    });

    this.engine.start();
  }

  stop(): void {
    if (this.engine) {
      this.engine.stop();
      const state = this.engine.getState();
      this.storage.set('game-state', {
        entities: state.getAllEntities()
      });
    }
  }
}

export const app = new App();
