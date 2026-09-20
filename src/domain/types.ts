// 领域模型：压差梯度与缓冲间通行闭环
// 只描述数据结构，不含任何判定逻辑与页面逻辑。

export type Role = "巡检员" | "厂务工程师" | "班组长";

export type ShiftId = "白班" | "夜班";

/** 相对相邻房间的压力方向：higher 本房间应/实测高于邻房，lower 反之 */
export type Direction = "higher" | "lower";

export type IsoClass = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";

/** 触发待复核的三条规则 */
export type RuleCode = "R1" | "R2" | "R3";
// R1：房间登记的走廊压差低于 5 Pa
// R2：相邻房间压差方向与设计梯度倒置
// R3：缓冲间在室人数达到 2 人

export type RequestStatus = "待复核" | "已放行";

export interface BufferRoom {
  id: string;
  name: string;
  /** 缓冲间满员阈值，固定为 2 */
  capacity: number;
  /** 当前在室人数 */
  occupancy: number;
}

export interface Room {
  id: string;
  isoClass: IsoClass;
  /** 房间登记走廊压差（Pa） */
  corridorPressure: number;
  /** 相邻房间编号 */
  adjacentId: string;
  /** 设计梯度：本房间相对相邻房间应有的方向 */
  expectedDirection: Direction;
  /** 登记的实测方向 */
  observedDirection: Direction;
  /** 相对相邻房间的实测压差幅度（Pa） */
  adjacentPressure: number;
  /** 关联缓冲间 */
  bufferRoomId: string;
}

/** 冲突行：冲突面板固定列出 房间、压差、人数、规则 */
export interface Conflict {
  rule: RuleCode;
  roomId: string;
  corridorPressure: number;
  occupancy: number;
  detail: string;
}

/** 放行/补录时冻结的一组读数（含人数） */
export interface FrozenSnapshot {
  corridorPressure: number;
  adjacentId: string;
  expectedDirection: Direction;
  observedDirection: Direction;
  adjacentPressure: number;
  bufferRoomId: string;
  occupancy: number;
}

/** 放行版本：v1 为放行冻结，之后每次补录追加一个带原因的新版本 */
export interface DataVersion {
  version: number;
  createdAt: string;
  shift: ShiftId;
  createdByRole: Role;
  reason: string;
  readings: FrozenSnapshot;
}

/** 跨班顺延记录：待复核申请在换班时追加一跳 */
export interface Carryover {
  fromShift: ShiftId;
  toShift: ShiftId;
  at: string;
}

export interface PassageRequest {
  id: string;
  roomId: string;
  status: RequestStatus;
  createdAt: string;
  createdShift: ShiftId;
  createdByRole: Role;
  /** 通行依据（提交时必填） */
  basis: string;
  /** 提交瞬间的读数与触发的冲突，用于复核留档 */
  submitReadings: FrozenSnapshot;
  submitConflicts: RuleCode[];
  carryovers: Carryover[];
  /** 以下字段在班组长放行后写入并冻结 */
  releasedAt?: string;
  releasedBy?: string;
  releaseShift?: ShiftId;
  reviewNote?: string;
  frozen?: FrozenSnapshot;
  currentVersion: number;
  versions: DataVersion[];
}

export interface AppState {
  rooms: Room[];
  buffers: BufferRoom[];
  requests: PassageRequest[];
  currentShift: ShiftId;
  currentRole: Role;
  sequence: number;
}
