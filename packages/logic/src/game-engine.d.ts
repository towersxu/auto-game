import { GameState } from './game-state';
export interface GameConfig {
    fps: number;
    width: number;
    height: number;
}
export declare class GameEngine {
    private config;
    private state;
    private lastTime;
    private running;
    constructor(config: GameConfig);
    start(): void;
    stop(): void;
    private loop;
    private update;
    getState(): GameState;
}
//# sourceMappingURL=game-engine.d.ts.map