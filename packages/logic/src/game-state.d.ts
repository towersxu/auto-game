export interface Entity {
    id: string;
    x: number;
    y: number;
}
export declare class GameState {
    private entities;
    addEntity(entity: Entity): void;
    removeEntity(id: string): void;
    getEntity(id: string): Entity | undefined;
    getAllEntities(): Entity[];
    update(deltaTime: number): void;
}
//# sourceMappingURL=game-state.d.ts.map