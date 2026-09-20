// 数据层：唯一仓储。localStorage 持久化 + 发布订阅，刷新后申请、放行版本与顺延状态一致。
// 数据读写全部收敛于此；判定规则在 rules 层，页面层只调用动作与选择器。

import { buildSeedState } from "./seed";
import { uid } from "./id";
import { nextShift, shiftInfo } from "../rules/shift";
import type {
  Airlock,
  AirlockVersion,
  AppState,
  ApplicationStatus,
  CarryRecord,
  Conflict,
  Direction,
  PassageApplication,
  RoomRegistration,
  RoomVersion,
} from "./types";

const STORAGE_KEY = "hxwl-09.pressure-pass-loop.v1";

type Listener = () => void;

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.applications)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回落到种子数据
  }
  return buildSeedState();
}

class Repository {
  private state: AppState = loadState();
  private listeners = new Set<Listener>();

  getState = (): AppState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(next: AppState): void {
    this.state = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 存储不可用时仍保持内存一致
    }
    this.listeners.forEach((l) => l());
  }

  reset(): void {
    this.commit(buildSeedState());
  }

  // ---------- 选择器 ----------

  getRoom(refId: string): RoomRegistration | undefined {
    return this.state.rooms.find((r) => r.id === refId);
  }

  getAirlock(airlockId: string): Airlock | undefined {
    return this.state.airlocks.find((a) => a.id === airlockId);
  }

  /** 房间登记是否已被放行单冻结 */
  isRoomFrozen(roomRefId: string): boolean {
    return this.state.applications.some(
      (a) => a.roomRefId === roomRefId && a.status === "released"
    );
  }

  /** 缓冲间人数是否已被放行单冻结 */
  isAirlockFrozen(airlockId: string): boolean {
    return this.state.applications.some(
      (a) => a.airlockId === airlockId && a.status === "released"
    );
  }

  // ---------- 房间登记 / 缓冲间 ----------

  registerRoom(input: {
    roomId: string;
    name: string;
    cleanClass: string;
    corridorPressurePa: number;
    adjacentRoomId: string;
    actualDirection: Direction;
    expectedDirection: Direction;
    airlockId: string;
  }): AppState {
    const ts = new Date().toISOString();
    const room: RoomRegistration = {
      ...input,
      id: uid("room"),
      version: 1,
      versions: [],
      createdAt: ts,
      updatedAt: ts,
    };
    room.versions = [
      {
        version: 1,
        corridorPressurePa: input.corridorPressurePa,
        adjacentRoomId: input.adjacentRoomId,
        actualDirection: input.actualDirection,
        expectedDirection: input.expectedDirection,
        airlockId: input.airlockId,
        changedAt: ts,
        changedBy: "登记人",
      },
    ];
    const next: AppState = {
      ...this.state,
      rooms: [room, ...this.state.rooms],
    };
    this.commit(next);
    return next;
  }

  registerAirlock(name: string): Airlock {
    const ts = new Date().toISOString();
    const airlock: Airlock = {
      id: uid("air"),
      name,
      capacity: 2,
      headcount: 0,
      version: 1,
      versions: [
        { version: 1, headcount: 0, changedAt: ts, changedBy: "登记人" },
      ],
      updatedAt: ts,
    };
    this.commit({ ...this.state, airlocks: [...this.state.airlocks, airlock] });
    return airlock;
  }

  /**
   * 修订房间登记。
   * 放行前：直接更新当前值（数据未冻结）。
   * 放行后冻结：必须带原因，旧值整体保留为新版本，当前值更新为新版本。
   */
  amendRoom(
    refId: string,
    patch: {
      corridorPressurePa: number;
      adjacentRoomId: string;
      actualDirection: Direction;
      expectedDirection: Direction;
      headcount: number;
      reason?: string;
    },
    operator: string
  ): AppState {
    const room = this.getRoom(refId);
    if (!room) throw new Error("房间登记不存在");
    const airlock = this.getAirlock(room.airlockId);
    if (!airlock) throw new Error("缓冲间不存在");

    const roomFrozen = this.isRoomFrozen(refId);
    const airlockFrozen = this.isAirlockFrozen(airlock.id);
    if ((roomFrozen || airlockFrozen) && !patch.reason?.trim()) {
      throw new Error("数据已冻结，补录必须填写原因并保留旧值");
    }

    const ts = new Date().toISOString();
    let nextRooms = this.state.rooms;
    let nextAirlocks = this.state.airlocks;

    const roomTouched =
      room.corridorPressurePa !== patch.corridorPressurePa ||
      room.adjacentRoomId !== patch.adjacentRoomId ||
      room.actualDirection !== patch.actualDirection ||
      room.expectedDirection !== patch.expectedDirection;

    if (roomTouched) {
      let updated: RoomRegistration;
      if (roomFrozen) {
        const version = room.version + 1;
        const entry: RoomVersion = {
          version,
          corridorPressurePa: patch.corridorPressurePa,
          adjacentRoomId: patch.adjacentRoomId,
          actualDirection: patch.actualDirection,
          expectedDirection: patch.expectedDirection,
          airlockId: room.airlockId,
          reason: patch.reason,
          changedAt: ts,
          changedBy: operator,
        };
        updated = {
          ...room,
          corridorPressurePa: patch.corridorPressurePa,
          adjacentRoomId: patch.adjacentRoomId,
          actualDirection: patch.actualDirection,
          expectedDirection: patch.expectedDirection,
          version,
          versions: [...room.versions, entry],
          updatedAt: ts,
        };
      } else {
        updated = {
          ...room,
          corridorPressurePa: patch.corridorPressurePa,
          adjacentRoomId: patch.adjacentRoomId,
          actualDirection: patch.actualDirection,
          expectedDirection: patch.expectedDirection,
          updatedAt: ts,
        };
      }
      nextRooms = this.state.rooms.map((r) => (r.id === refId ? updated : r));
    }

    if (airlock.headcount !== patch.headcount) {
      let updatedAir: Airlock;
      if (airlockFrozen) {
        const version = airlock.version + 1;
        const entry: AirlockVersion = {
          version,
          headcount: patch.headcount,
          reason: patch.reason,
          changedAt: ts,
          changedBy: operator,
        };
        updatedAir = {
          ...airlock,
          headcount: patch.headcount,
          version,
          versions: [...airlock.versions, entry],
          updatedAt: ts,
        };
      } else {
        updatedAir = { ...airlock, headcount: patch.headcount, updatedAt: ts };
      }
      nextAirlocks = this.state.airlocks.map((a) =>
        a.id === airlock.id ? updatedAir : a
      );
    }

    const next = { ...this.state, rooms: nextRooms, airlocks: nextAirlocks };
    this.commit(next);
    return next;
  }

  // ---------- 通行申请闭环 ----------

  createApplication(input: {
    roomRefId: string;
    applicant: string;
    conflicts: Conflict[];
  }): PassageApplication {
    const room = this.getRoom(input.roomRefId);
    if (!room) throw new Error("房间登记不存在");
    const airlock = this.getAirlock(room.airlockId);
    if (!airlock) throw new Error("缓冲间不存在");

    const ts = new Date().toISOString();
    const seq = this.state.seq.application + 1;
    const shift = shiftInfo(this.state.shiftBaseDate, this.state.shiftIndex);
    const code = `PASS-${ts.slice(2, 10).replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;

    const app: PassageApplication = {
      id: uid("app"),
      code,
      roomRefId: room.id,
      airlockId: airlock.id,
      applicant: input.applicant.trim() || "未署名巡检员",
      shift: shift.label,
      createdAt: ts,
      status: input.conflicts.length === 0 ? "released" : "pending_review",
      conflicts: input.conflicts,
      snapshot: {
        roomVersion: room.version,
        airlockVersion: airlock.version,
        corridorPressurePa: room.corridorPressurePa,
        actualDirection: room.actualDirection,
        expectedDirection: room.expectedDirection,
        headcount: airlock.headcount,
      },
      carries: [],
    };
    if (app.status === "released") {
      app.releaseKind = "auto";
      app.releaseShift = shift.label;
      app.releasedAt = ts;
      app.reviewer = "系统自动放行";
    }

    this.commit({
      ...this.state,
      seq: { application: seq },
      applications: [app, ...this.state.applications],
    });
    return app;
  }

  /** 班组长复核放行：依据必填；放行后房间数据与缓冲间人数冻结 */
  releaseApplication(input: {
    applicationId: string;
    basis: string;
    reviewer: string;
  }): PassageApplication {
    const app = this.state.applications.find((a) => a.id === input.applicationId);
    if (!app) throw new Error("通行申请不存在");
    if (app.status === "released") throw new Error("该申请已放行，数据处于冻结状态");
    if (!input.basis.trim()) throw new Error("放行必须填写复核依据");
    if (!input.reviewer.includes("班组长")) {
      throw new Error("仅班组长可复核放行");
    }

    const ts = new Date().toISOString();
    const shift = shiftInfo(this.state.shiftBaseDate, this.state.shiftIndex);
    const updated: PassageApplication = {
      ...app,
      status: "released",
      basis: input.basis.trim(),
      reviewer: input.reviewer,
      releasedAt: ts,
      releaseShift: shift.label,
      releaseKind: "review",
    };
    this.commit({
      ...this.state,
      applications: this.state.applications.map((a) =>
        a.id === app.id ? updated : a
      ),
    });
    return updated;
  }

  /** 跨班交接：本班未复核（含待复核）的申请顺延至下一班 */
  advanceShift(): AppState {
    const current = shiftInfo(this.state.shiftBaseDate, this.state.shiftIndex);
    const following = nextShift(this.state.shiftBaseDate, this.state.shiftIndex);
    const ts = new Date().toISOString();
    const carry: CarryRecord = {
      fromShift: current.label,
      toShift: following.label,
      at: ts,
    };

    const applications = this.state.applications.map((a): PassageApplication => {
      if (a.status === "released") return a;
      if (a.status === "pending_review" || a.status === "deferred") {
        const nextStatus: ApplicationStatus = "deferred";
        return { ...a, status: nextStatus, carries: [...a.carries, carry] };
      }
      return a;
    });

    this.commit({
      ...this.state,
      shiftIndex: this.state.shiftIndex + 1,
      applications,
    });
    return this.state;
  }
}

export const repo = new Repository();
