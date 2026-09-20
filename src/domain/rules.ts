// 判定层：压差梯度与缓冲间通行规则（纯函数，不依赖 React 与存储）。
import type {
  AppState,
  Carryover,
  Conflict,
  Direction,
  FrozenSnapshot,
  Room,
  RuleCode,
  ShiftId,
} from "./types";

/** 走廊压差下限（Pa） */
export const MIN_CORRIDOR_PRESSURE = 5;
/** 缓冲间同时在室人数上限 */
export const BUFFER_LIMIT = 2;

export const RULE_LABELS: Record<RuleCode, string> = {
  R1: "走廊压差 < 5 Pa",
  R2: "相邻房间压差方向倒置",
  R3: "缓冲间人数 = 2 人",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  higher: "本房间高于邻房",
  lower: "本房间低于邻房",
};

export function findBuffer(state: Pick<AppState, "buffers">, bufferRoomId: string) {
  return state.buffers.find((buffer) => buffer.id === bufferRoomId);
}

export function bufferOccupancy(state: Pick<AppState, "buffers">, bufferRoomId: string): number {
  return findBuffer(state, bufferRoomId)?.occupancy ?? 0;
}

function describeDirection(room: Room): string {
  const match = room.observedDirection === room.expectedDirection;
  return `设计「${DIRECTION_LABELS[room.expectedDirection]}」 / 实测「${
    DIRECTION_LABELS[room.observedDirection]
  }」${match ? "" : "（倒置）"}`;
}

/** 按房间逐条套用规则，返回该房间触发的冲突（可能同时命中多条） */
export function evaluateRoom(state: Pick<AppState, "rooms" | "buffers">, room: Room): Conflict[] {
  const occupancy = bufferOccupancy(state, room.bufferRoomId);
  const conflicts: Conflict[] = [];

  if (room.corridorPressure < MIN_CORRIDOR_PRESSURE) {
    conflicts.push({
      rule: "R1",
      roomId: room.id,
      corridorPressure: room.corridorPressure,
      occupancy,
      detail: `走廊压差 ${room.corridorPressure} Pa，低于 ${MIN_CORRIDOR_PRESSURE} Pa 下限`,
    });
  }

  if (room.observedDirection !== room.expectedDirection) {
    conflicts.push({
      rule: "R2",
      roomId: room.id,
      corridorPressure: room.corridorPressure,
      occupancy,
      detail: `相邻房间 ${room.adjacentId} 梯度倒置：${describeDirection(room)}，实测压差 ${room.adjacentPressure} Pa`,
    });
  }

  if (occupancy >= BUFFER_LIMIT) {
    conflicts.push({
      rule: "R3",
      roomId: room.id,
      corridorPressure: room.corridorPressure,
      occupancy,
      detail: `缓冲间 ${room.bufferRoomId} 在室 ${occupancy} 人，达到 ${BUFFER_LIMIT} 人上限`,
    });
  }

  return conflicts;
}

/** 全量扫描，冲突面板与申请判定共用同一结果 */
export function evaluateConflicts(state: Pick<AppState, "rooms" | "buffers">): Conflict[] {
  return state.rooms.flatMap((room) => evaluateRoom(state, room));
}

export function conflictsForRoom(
  state: Pick<AppState, "rooms" | "buffers">,
  roomId: string
): Conflict[] {
  const room = state.rooms.find((item) => item.id === roomId);
  return room ? evaluateRoom(state, room) : [];
}

/** 复制某房间当前读数（含缓冲间人数），放行/补录冻结用 */
export function snapshotRoom(
  state: Pick<AppState, "rooms" | "buffers">,
  room: Room
): FrozenSnapshot {
  return {
    corridorPressure: room.corridorPressure,
    adjacentId: room.adjacentId,
    expectedDirection: room.expectedDirection,
    observedDirection: room.observedDirection,
    adjacentPressure: room.adjacentPressure,
    bufferRoomId: room.bufferRoomId,
    occupancy: bufferOccupancy(state, room.bufferRoomId),
  };
}

export function isBlocked(conflicts: Conflict[]): boolean {
  return conflicts.length > 0;
}

/** 判定一次申请是否命中规则 */
export function rulesHit(state: Pick<AppState, "rooms" | "buffers">, roomId: string): RuleCode[] {
  return conflictsForRoom(state, roomId).map((conflict) => conflict.rule);
}

export interface PendingRequest {
  id: string;
  createdShift: ShiftId;
  carryovers: Carryover[];
}

/**
 * 跨班未复核顺延：换班时所有「仍在待复核」的申请追加一条顺延记录。
 * 同班次重复切换不重复顺延。
 */
export function pendingCarryovers(
  pending: PendingRequest[],
  fromShift: ShiftId,
  toShift: ShiftId,
  at: string
): Map<string, Carryover> {
  const result = new Map<string, Carryover>();
  if (fromShift === toShift) return result;
  for (const request of pending) {
    const lastShift =
      request.carryovers.length > 0
        ? request.carryovers[request.carryovers.length - 1].toShift
        : request.createdShift;
    if (lastShift === fromShift) {
      result.set(request.id, { fromShift, toShift, at });
    }
  }
  return result;
}

/** 是否为跨班顺延到当前班次仍未复核的申请 */
export function carriedInto(request: PendingRequest, currentShift: ShiftId): boolean {
  return request.carryovers.some((carry) => carry.toShift === currentShift);
}
