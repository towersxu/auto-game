# 坐标系统说明

本说明文档对应 `packages/logic/src/coordinate-system.ts` 中的坐标系统实现，适用于无限网格世界的区块管理。

## 1. 坐标层级

系统使用三层坐标：

1. **世界坐标 (x, y)**：玩家/实体的全局格子坐标，可为负数。
2. **区块坐标 (cx, cy)**：世界坐标所属的区块编号。
3. **区块内坐标 (lx, ly)**：区块内的本地格子索引，范围为 `0 ~ CHUNK_SIZE - 1`。

### 1.1 区块大小

- `CHUNK_SIZE = 16`
- 每个区块包含 `16 × 16` 个格子。

### 1.2 坐标换算公式

- 世界坐标 → 区块坐标：

```ts
const cx = Math.floor(x / CHUNK_SIZE);
const cy = Math.floor(y / CHUNK_SIZE);
```

- 世界坐标 → 区块内坐标（处理负数）：

```ts
const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
```

## 2. 区块标识

区块使用字符串作为唯一标识：

```ts
const chunkId = `${cx}:${cy}`;
```

## 3. Chunk 数据结构

`Chunk` 负责保存区块内的静态地块与动态实体：

- `staticTiles`：长度为 `CHUNK_SIZE * CHUNK_SIZE` 的数组，索引规则为 `ly * CHUNK_SIZE + lx`。
- `entities`：`Map<string, ChunkEntity>`，存放动态实体数据。
- `dirty`：标记区块是否被修改，用于持久化判断。

常用 API：

- `getTile(lx, ly)` / `setTile(lx, ly, tileId)`
- `addEntity(entity)` / `removeEntity(entityId)`
- `serialize()` / `Chunk.deserialize(data)`

## 4. ChunkManager 管理器

`ChunkManager` 负责管理活跃区块与实体位置：

- `registerEntity(entityId, x, y)`：注册并放置实体。
- `moveEntity(entityId, targetX, targetY)`：自动处理跨区块移动。
- `updateActiveChunks(centerX, centerY, viewRadius)`：按视距加载/卸载区块。
- `getVisibleChunks(centerX, centerY, radius)`：获取可见区块集合。
- `getDirtyChunks()`：获取需要持久化的区块。
- `serializeChunk(cx, cy)` / `loadChunk(data)`：区块序列化与加载。

## 5. 负坐标示例

以下示例展示了负坐标的处理方式：

```text
World(-1, 0)  -> Chunk(-1, 0), Local(15, 0)
World(-16, 0) -> Chunk(-1, 0), Local(0, 0)
World(-17, 0) -> Chunk(-2, 0), Local(15, 0)
```

## 6. 使用示例

完整使用示例可参考：

- `packages/logic/examples/coordinate-system-usage.ts`
