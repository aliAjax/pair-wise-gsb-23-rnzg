// 数据层：种子数据、状态变更（reducer）与 localStorage 持久化。
// 判定一律委托 domain/rules，本文件不出现阈值与方向规则。
import {
  BUFFER_LIMIT,
  pendingCarryovers,
  rulesHit,
  snapshotRoom,
} from "../domain/rules";
import type {
  AppState,
  BufferRoom,
  DataVersion,
  Direction,
  FrozenSnapshot,
  PassageRequest,
  Role,
  Room,
  ShiftId,
} from "../domain/types";

const STORAGE_KEY = "hxwl-09-pressure-loop-v1";

// ---------- 种子数据 ----------

const seedBuffers: BufferRoom[] = [
  { id: "B-12", name: "一更缓冲间 12", capacity: BUFFER_LIMIT, occupancy: 2 },
  { id: "B-21", name: "缓冲间 21", capacity: BUFFER_LIMIT, occupancy: 1 },
  { id: "B-30", name: "缓冲间 30", capacity: BUFFER_LIMIT, occupancy: 0 },
  { id: "B-03", name: "黄光缓冲间 03", capacity: BUFFER_LIMIT, occupancy: 1 },
];

function room(
  id: string,
  isoClass: Room["isoClass"],
  corridorPressure: number,
  adjacentId: string,
  expectedDirection: Direction,
  observedDirection: Direction,
  adjacentPressure: number,
  bufferRoomId: string
): Room {
  return {
    id,
    isoClass,
    corridorPressure,
    adjacentId,
    expectedDirection,
    observedDirection,
    adjacentPressure,
    bufferRoomId,
  };
}

const seedRooms: Room[] = [
  room("CR-1201", "ISO 5", 4, "CR-1202", "higher", "lower", 3, "B-12"),
  room("CR-1202", "ISO 6", 12, "CR-1203", "higher", "higher", 8, "B-12"),
  room("CR-2107", "ISO 6", 15, "CR-2106", "higher", "higher", 10, "B-21"),
  room("CR-2106", "ISO 7", 8, "CR-2107", "lower", "lower", 10, "B-21"),
  room("CR-3110", "ISO 7", 6, "CR-3109", "higher", "lower", 2, "B-30"),
  room("Y-0302", "黄光区", 3, "Y-0301", "lower", "lower", 6, "B-03"),
];

function freeze(room: Room, buffers: BufferRoom[]): FrozenSnapshot {
  return snapshotRoom({ rooms: [room], buffers }, room);
}

function buildSeedRequests(rooms: Room[], buffers: BufferRoom[]): PassageRequest[] {
  const r1201 = rooms.find((item) => item.id === "CR-1201")!;
  const r3110 = rooms.find((item) => item.id === "CR-3110")!;
  const r2107 = rooms.find((item) => item.id === "CR-2107")!;

  const releasedSnapshot = freeze(r2107, buffers);
  const v1: DataVersion = {
    version: 1,
    createdAt: "2026-09-20T08:36:00+08:00",
    shift: "白班",
    createdByRole: "班组长",
    reason: "梯度与人数均符合，班组长直接放行",
    readings: releasedSnapshot,
  };
  const v2: DataVersion = {
    version: 2,
    createdAt: "2026-09-20T09:05:00+08:00",
    shift: "白班",
    createdByRole: "厂务工程师",
    reason: "补录：走廊压差由 15 Pa 复核为 16 Pa，旧值保留于 v1",
    readings: { ...releasedSnapshot, corridorPressure: 16 },
  };

  return [
    {
      id: "RQ-20260920-001",
      roomId: "CR-1201",
      status: "待复核",
      createdAt: "2026-09-20T05:48:00+08:00",
      createdShift: "夜班",
      createdByRole: "巡检员",
      basis: "夜班设备搬入需经 B-12 进入 CR-1201，作业单 EQ-MOVE-2207",
      submitReadings: freeze(r1201, buffers),
      submitConflicts: ["R1", "R2", "R3"],
      carryovers: [
        { fromShift: "夜班", toShift: "白班", at: "2026-09-20T08:00:00+08:00" },
      ],
      currentVersion: 0,
      versions: [],
    },
    {
      id: "RQ-20260920-002",
      roomId: "CR-3110",
      status: "待复核",
      createdAt: "2026-09-20T09:20:00+08:00",
      createdShift: "白班",
      createdByRole: "巡检员",
      basis: "CR-3110 过滤器例行点检，需短时通行",
      submitReadings: freeze(r3110, buffers),
      submitConflicts: ["R2"],
      carryovers: [],
      currentVersion: 0,
      versions: [],
    },
    {
      id: "RQ-20260920-003",
      roomId: "CR-2107",
      status: "已放行",
      createdAt: "2026-09-20T08:30:00+08:00",
      createdShift: "白班",
      createdByRole: "巡检员",
      basis: "白班例行巡检通行，作业单 ROUTINE-0920",
      submitReadings: releasedSnapshot,
      submitConflicts: [],
      carryovers: [],
      releasedAt: "2026-09-20T08:36:00+08:00",
      releasedBy: "班组长",
      releaseShift: "白班",
      reviewNote: "走廊压差 15 Pa、方向正常、缓冲间 1 人，放行",
      frozen: releasedSnapshot,
      currentVersion: 2,
      versions: [v1, v2],
    },
  ];
}

export function createSeedState(): AppState {
  return {
    rooms: seedRooms.map((item) => ({ ...item })),
    buffers: seedBuffers.map((item) => ({ ...item })),
    requests: buildSeedRequests(seedRooms, seedBuffers),
    currentShift: "白班",
    currentRole: "巡检员",
    sequence: 4,
  };
}

// ---------- Actions ----------

export type Action =
  | { type: "setRole"; role: Role }
  | {
      type: "updateRoom";
      id: string;
      patch: Partial<
        Pick<
          Room,
          | "corridorPressure"
          | "adjacentId"
          | "expectedDirection"
          | "observedDirection"
          | "adjacentPressure"
        >
      >;
    }
  | { type: "updateBuffer"; id: string; occupancy: number }
  | { type: "submitRequest"; roomId: string; basis: string }
  | { type: "releaseRequest"; id: string; note: string }
  | { type: "amendRequest"; id: string; readings: FrozenSnapshot; reason: string }
  | { type: "switchShift"; toShift: ShiftId }
  | { type: "resetSeed" };

// ---------- 纯工具 ----------

function nowIso(): string {
  return new Date().toISOString();
}

function newRequestId(state: AppState): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `RQ-${ymd}-${String(state.sequence).padStart(3, "0")}`;
}

function frozenVersion(
  version: number,
  shift: ShiftId,
  role: Role,
  reason: string,
  readings: FrozenSnapshot
): DataVersion {
  return { version, createdAt: nowIso(), shift, createdByRole: role, reason, readings };
}

// ---------- Reducer ----------

export function reducer(prev: AppState, action: Action): AppState {
  switch (action.type) {
    case "setRole":
      return { ...prev, currentRole: action.role };

    case "updateRoom":
      return {
        ...prev,
        rooms: prev.rooms.map((room) =>
          room.id === action.id ? { ...room, ...action.patch } : room
        ),
      };

    case "updateBuffer":
      return {
        ...prev,
        buffers: prev.buffers.map((buffer) =>
          buffer.id === action.id
            ? { ...buffer, occupancy: Math.max(0, Math.min(buffer.capacity, action.occupancy)) }
            : buffer
        ),
      };

    case "submitRequest": {
      const room = prev.rooms.find((item) => item.id === action.roomId);
      if (!room || action.basis.trim() === "") return prev;

      const hit = rulesHit(prev, room.id);
      const readings = snapshotRoom(prev, room);
      const base: PassageRequest = {
        id: newRequestId(prev),
        roomId: room.id,
        status: "待复核",
        createdAt: nowIso(),
        createdShift: prev.currentShift,
        createdByRole: prev.currentRole,
        basis: action.basis.trim(),
        submitReadings: readings,
        submitConflicts: hit,
        carryovers: [],
        currentVersion: 0,
        versions: [],
      };

      const next: AppState = {
        ...prev,
        sequence: prev.sequence + 1,
        requests: [base, ...prev.requests],
      };

      // 无冲突：直接放行并冻结；命中任一规则：停在待复核，等待班组长放行
      if (hit.length === 0) {
        const id = base.id;
        return releaseNow(next, id, "无规则冲突，班组长直接放行并冻结读数");
      }
      return next;
    }

    case "releaseRequest": {
      const target = prev.requests.find((item) => item.id === action.id);
      if (!target || target.status !== "待复核" || action.note.trim() === "") return prev;
      return releaseNow(prev, action.id, action.note.trim());
    }

    case "amendRequest": {
      if (action.reason.trim() === "") return prev;
      return {
        ...prev,
        requests: prev.requests.map((request) => {
          if (request.id !== action.id || request.status !== "已放行") return request;
          // 只追加带原因的新版本，旧值原样保留
          const version = frozenVersion(
            request.currentVersion + 1,
            prev.currentShift,
            prev.currentRole,
            action.reason.trim(),
            action.readings
          );
          return {
            ...request,
            currentVersion: version.version,
            versions: [...request.versions, version],
          };
        }),
      };
    }

    case "switchShift": {
      if (action.toShift === prev.currentShift) return prev;
      const at = nowIso();
      const carryMap = pendingCarryovers(
        prev.requests
          .filter((item) => item.status === "待复核")
          .map((item) => ({
            id: item.id,
            createdShift: item.createdShift,
            carryovers: item.carryovers,
          })),
        prev.currentShift,
        action.toShift,
        at
      );
      if (carryMap.size === 0) return { ...prev, currentShift: action.toShift };
      return {
        ...prev,
        currentShift: action.toShift,
        requests: prev.requests.map((request) => {
          const carry = carryMap.get(request.id);
          return carry ? { ...request, carryovers: [...request.carryovers, carry] } : request;
        }),
      };
    }

    case "resetSeed":
      return createSeedState();

    default:
      return prev;
  }
}

/** 放行：冻结当前读数与人数，写入 v1 */
function releaseNow(state: AppState, id: string, note: string): AppState {
  return {
    ...state,
    requests: state.requests.map((request) => {
      if (request.id !== id || request.status !== "待复核") return request;
      const room = state.rooms.find((item) => item.id === request.roomId);
      if (!room) return request;
      const frozen = snapshotRoom(state, room);
      const v1 = frozenVersion(1, state.currentShift, "班组长", note, frozen);
      return {
        ...request,
        status: "已放行",
        releasedAt: nowIso(),
        releasedBy: "班组长",
        releaseShift: state.currentShift,
        reviewNote: note,
        frozen,
        currentVersion: 1,
        versions: [v1],
      };
    }),
  };
}

// ---------- 持久化：刷新后申请、放行版本、顺延状态一致 ----------

export function loadState(): AppState {
  if (typeof window === "undefined") return createSeedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.rooms || !parsed.requests || !parsed.buffers) return createSeedState();
    return parsed;
  } catch {
    return createSeedState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时退化为内存态，不影响当前会话判定
  }
}
