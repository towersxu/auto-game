export class GameState {
    entities = new Map();
    addEntity(entity) {
        this.entities.set(entity.id, entity);
    }
    removeEntity(id) {
        this.entities.delete(id);
    }
    getEntity(id) {
        return this.entities.get(id);
    }
    getAllEntities() {
        return Array.from(this.entities.values());
    }
    update(deltaTime) {
        for (const entity of this.entities.values()) {
            entity.x += deltaTime * 0.01;
            entity.y += deltaTime * 0.01;
        }
    }
}
//# sourceMappingURL=game-state.js.map