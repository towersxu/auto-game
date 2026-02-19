import { GameState } from './game-state';
export class GameEngine {
    config;
    state;
    lastTime = 0;
    running = false;
    constructor(config) {
        this.config = config;
        this.state = new GameState();
    }
    start() {
        this.running = true;
        this.lastTime = performance.now();
        this.loop();
    }
    stop() {
        this.running = false;
    }
    loop() {
        if (!this.running)
            return;
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        if (deltaTime >= 1000 / this.config.fps) {
            this.update(deltaTime);
            this.lastTime = currentTime;
        }
        requestAnimationFrame(() => this.loop());
    }
    update(deltaTime) {
        this.state.update(deltaTime);
    }
    getState() {
        return this.state;
    }
}
//# sourceMappingURL=game-engine.js.map