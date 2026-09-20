// 判定层：压差梯度与缓冲间通行规则。纯函数，不依赖存储与页面。

import type {
  Airlock,
  Conflict,
  Direction,
  RoomRegistration,
  RuleId,
} from "../data/types";

/** 走廊压差下限：低于 5Pa 命中 */
export const MIN_CORRIDOR_PRESSURE_PA = 5;
/** 缓冲间人数上限：到两人命中 */
export const AIRLOCK_FULL_HEADCOUNT = 2;

export const RULE_LABELS: Record<RuleId, string> = {
  LOW_CORRIDOR_PRESSURE: "走廊压差低于5Pa",
  DIRECTION_INVERTED: "相邻房间压差方向倒置",
  AIRLOCK_CAPACITY: "缓冲间人数达到两人",
};

export const RULE_DETAILS: Record<RuleId, string> = {
  LOW_CORRIDOR_PRESSURE: "房间相对走廊压差低于 5Pa 梯度下限",
  DIRECTION_INVERTED: "实测压差方向与梯度要求方向相反",
  AIRLOCK_CAPACITY: "缓冲间人数已到两人，暂停增员通行",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  positive: "正压（房间 → 相邻）",
  negative: "负压（相邻 → 房间）",
};

export function isLowCorridorPressure(room: RoomRegistration): boolean {
  return room.corridorPressurePa < MIN_CORRIDOR_PRESSURE_PA;
}

export function isDirectionInverted(room: RoomRegistration): boolean {
  return room.actualDirection !== room.expectedDirection;
}

export function isAirlockFull(airlock: Airlock | undefined): boolean {
  return !!airlock && airlock.headcount >= AIRLOCK_FULL_HEADCOUNT;
}

/** 评估单个房间+缓冲间命中的规则，返回冲突列表（空列表表示可自动放行） */
export function evaluate(
  room: RoomRegistration,
  airlock: Airlock | undefined
): Conflict[] {
  const conflicts: Conflict[] = [];
  const airlockName = airlock ? airlock.name : "未分配缓冲间";
  const headcount = airlock ? airlock.headcount : 0;

  if (isLowCorridorPressure(room)) {
    conflicts.push({
      ruleId: "LOW_CORRIDOR_PRESSURE",
      roomId: room.roomId,
      roomLabel: room.name,
      airlockName,
      corridorPressurePa: room.corridorPressurePa,
      headcount,
      detail: `${room.roomId} 走廊压差 ${room.corridorPressurePa}Pa < ${MIN_CORRIDOR_PRESSURE_PA}Pa`,
    });
  }
  if (isDirectionInverted(room)) {
    conflicts.push({
      ruleId: "DIRECTION_INVERTED",
      roomId: room.roomId,
      roomLabel: room.name,
      airlockName,
      corridorPressurePa: room.corridorPressurePa,
      headcount,
      detail: `${room.roomId} 实测${DIRECTION_LABELS[room.actualDirection]}，要求${DIRECTION_LABELS[room.expectedDirection]}`,
    });
  }
  if (airlock && isAirlockFull(airlock)) {
    conflicts.push({
      ruleId: "AIRLOCK_CAPACITY",
      roomId: room.roomId,
      roomLabel: room.name,
      airlockName,
      corridorPressurePa: room.corridorPressurePa,
      headcount: airlock.headcount,
      detail: `${airlock.name} 人数 ${airlock.headcount}/${AIRLOCK_FULL_HEADCOUNT}`,
    });
  }
  return conflicts;
}

/** 全量实时冲突，用于看板冲突清单 */
export function evaluateAll(
  rooms: RoomRegistration[],
  airlocks: Airlock[]
): Conflict[] {
  const map = new Map(airlocks.map((a) => [a.id, a]));
  return rooms.flatMap((room) => evaluate(room, map.get(room.airlockId)));
}
