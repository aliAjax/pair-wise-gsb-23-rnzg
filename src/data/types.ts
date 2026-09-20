// 数据层：洁净室压差梯度与缓冲间通行闭环的领域数据结构

export type Role = "巡检员" | "厂务工程师" | "班组长";

/** 压差方向：本房间相对相邻房间的实测/要求方向 */
export type Direction = "positive" | "negative";

export type RuleId =
  | "LOW_CORRIDOR_PRESSURE" // 走廊压差低于 5Pa
  | "DIRECTION_INVERTED" // 相邻房间压差方向倒置
  | "AIRLOCK_CAPACITY"; // 缓冲间人数达到两人

/** 规则冲突快照（随申请留档，房间字段值取自申请时刻） */
export interface Conflict {
  ruleId: RuleId;
  roomId: string;
  roomLabel: string;
  airlockName: string;
  corridorPressurePa: number;
  headcount: number;
  detail: string;
}

/** 房间登记的历史版本（补录留旧值） */
export interface RoomVersion {
  version: number;
  corridorPressurePa: number;
  adjacentRoomId: string;
  actualDirection: Direction;
  expectedDirection: Direction;
  airlockId: string;
  reason?: string;
  changedAt: string;
  changedBy: string;
}

/** 房间登记：走廊压差、相邻房间压差方向、所属缓冲间 */
export interface RoomRegistration {
  id: string;
  roomId: string; // 房间编号
  name: string;
  cleanClass: string;
  corridorPressurePa: number; // 房间相对走廊压差 Pa
  adjacentRoomId: string; // 相邻房间编号
  actualDirection: Direction; // 实测压差方向
  expectedDirection: Direction; // 梯度要求方向
  airlockId: string;
  version: number;
  versions: RoomVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface AirlockVersion {
  version: number;
  headcount: number;
  reason?: string;
  changedAt: string;
  changedBy: string;
}

/** 缓冲间：人数单独留版本 */
export interface Airlock {
  id: string;
  name: string;
  capacity: number; // 容量上限，达到两人即触发规则
  headcount: number;
  version: number;
  versions: AirlockVersion[];
  updatedAt: string;
}

/** 申请时刻冻结的房间+缓冲间数据快照 */
export interface ApplicationSnapshot {
  roomVersion: number;
  airlockVersion: number;
  corridorPressurePa: number;
  actualDirection: Direction;
  expectedDirection: Direction;
  headcount: number;
}

/** 跨班顺延记录 */
export interface CarryRecord {
  fromShift: string;
  toShift: string;
  at: string;
}

/**
 * 通行申请状态机：
 * pending_review 待复核（命中规则，停在复核环节）
 * deferred       跨班未复核，顺延至下一班（仍待复核）
 * released       已放行（自动放行 / 班组长复核放行，数据与人数冻结）
 */
export type ApplicationStatus = "pending_review" | "deferred" | "released";

export interface PassageApplication {
  id: string;
  code: string;
  roomRefId: string; // RoomRegistration.id
  airlockId: string;
  applicant: string;
  shift: string; // 创建班次
  createdAt: string;
  status: ApplicationStatus;
  conflicts: Conflict[];
  snapshot: ApplicationSnapshot;
  basis?: string; // 复核依据
  reviewer?: string; // 放行班组长
  releasedAt?: string;
  releaseShift?: string;
  releaseKind?: "auto" | "review";
  carries: CarryRecord[];
}

export interface AppState {
  rooms: RoomRegistration[];
  airlocks: Airlock[];
  applications: PassageApplication[];
  shiftBaseDate: string;
  shiftIndex: number;
  seq: { application: number };
}
