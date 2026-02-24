export interface Entity {
  id: string;
  x: number;
  y: number;
}

const ENTITY_MOVEMENT_SPEED = 0.01;

export class GameState {
  private entities: Map<string, Entity> = new Map();

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  update(deltaTime: number): void {
    for (const entity of this.entities.values()) {
      entity.x += deltaTime * ENTITY_MOVEMENT_SPEED;
      entity.y += deltaTime * ENTITY_MOVEMENT_SPEED;
    }
  }
}
