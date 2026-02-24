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
    
    const savedGameState = this.storage.get<Record<string, unknown>>('game-state');
    if (savedGameState) {
      console.log('Loaded saved state:', savedGameState);
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
      const currentGameState = this.engine.getState();
      this.storage.set('game-state', {
        entities: currentGameState.getAllEntities()
      });
    }
  }
}

export const app = new App();
