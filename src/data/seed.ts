// 数据层：初始种子数据（房间登记、缓冲间、历史申请/放行/顺延）

import {
  AIRLOCK_FULL_HEADCOUNT,
  RULE_DETAILS,
} from "../rules/pressureRules";
import type {
  Airlock,
  AppState,
  Conflict,
  PassageApplication,
  RoomRegistration,
  RoomVersion,
  AirlockVersion,
} from "./types";
import { uid } from "./id";

const now = new Date().toISOString();

function roomVersion(room: {
  corridorPressurePa: number;
  adjacentRoomId: string;
  actualDirection: RoomRegistration["actualDirection"];
  expectedDirection: RoomRegistration["actualDirection"];
  airlockId: string;
  createdAt: string;
}): RoomVersion {
  return {
    version: 1,
    corridorPressurePa: room.corridorPressurePa,
    adjacentRoomId: room.adjacentRoomId,
    actualDirection: room.actualDirection,
    expectedDirection: room.expectedDirection,
    airlockId: room.airlockId,
    changedAt: room.createdAt,
    changedBy: "系统初始化",
  };
}

function makeRoom(input: {
  roomId: string;
  name: string;
  cleanClass: string;
  corridorPressurePa: number;
  adjacentRoomId: string;
  actualDirection: RoomRegistration["actualDirection"];
  expectedDirection: RoomRegistration["actualDirection"];
  airlockId: string;
}): RoomRegistration {
  const base = { ...input, createdAt: now, updatedAt: now };
  return { ...base, id: uid("room"), version: 1, versions: [roomVersion(base)] };
}

function airlockV1(a: Pick<Airlock, "headcount">, at = now): AirlockVersion {
  return { version: 1, headcount: a.headcount, changedAt: at, changedBy: "系统初始化" };
}

export function buildSeedState(): AppState {
  const air01: Airlock = {
    id: uid("air"),
    name: "AIR-01 缓冲间",
    capacity: AIRLOCK_FULL_HEADCOUNT,
    headcount: 2,
    version: 1,
    versions: [],
    updatedAt: now,
  };
  air01.versions = [airlockV1(air01)];

  const air02: Airlock = {
    id: uid("air"),
    name: "AIR-02 缓冲间",
    capacity: AIRLOCK_FULL_HEADCOUNT,
    headcount: 0,
    version: 1,
    versions: [],
    updatedAt: now,
  };
  air02.versions = [airlockV1(air02)];

  // AIR-04 已被放行冻结，后补录过一次人数（v2 留旧值）
  const frozenAt = "2026-09-19T22:31:00.000Z";
  const air04: Airlock = {
    id: uid("air"),
    name: "AIR-04 缓冲间",
    capacity: AIRLOCK_FULL_HEADCOUNT,
    headcount: 1,
    version: 2,
    versions: [
      { version: 1, headcount: 0, changedAt: frozenAt, changedBy: "班组长-李敏" },
      {
        version: 2,
        headcount: 1,
        reason: "维护人员撤出一人后据实补录，旧值0保留",
        changedAt: "2026-09-20T01:05:00.000Z",
        changedBy: "巡检员-周倩",
      },
    ],
    updatedAt: "2026-09-20T01:05:00.000Z",
  };

  const air03: Airlock = {
    id: uid("air"),
    name: "AIR-03 缓冲间",
    capacity: AIRLOCK_FULL_HEADCOUNT,
    headcount: 0,
    version: 1,
    versions: [],
    updatedAt: now,
  };
  air03.versions = [airlockV1(air03)];

  const airlocks = [air01, air02, air03, air04];

  // CR-1201：走廊低压 + 方向倒置 + 缓冲间满员，三重命中
  const cr1201 = makeRoom({
    roomId: "CR-1201",
    name: "光刻间",
    cleanClass: "ISO 5",
    corridorPressurePa: 3,
    adjacentRoomId: "CR-1202",
    actualDirection: "negative",
    expectedDirection: "positive",
    airlockId: air01.id,
  });

  // CR-2107：梯度正常
  const cr2107 = makeRoom({
    roomId: "CR-2107",
    name: "刻蚀间",
    cleanClass: "ISO 6",
    corridorPressurePa: 15,
    adjacentRoomId: "CR-2106",
    actualDirection: "positive",
    expectedDirection: "positive",
    airlockId: air02.id,
  });

  // CR-3304：当前正常，历史上低压申请跨班顺延
  const cr3304 = makeRoom({
    roomId: "CR-3304",
    name: "薄膜间",
    cleanClass: "ISO 7",
    corridorPressurePa: 8,
    adjacentRoomId: "CR-3303",
    actualDirection: "positive",
    expectedDirection: "positive",
    airlockId: air03.id,
  });

  // Y-0302：上一班班组长复核放行，房间登记已冻结
  const y0302 = makeRoom({
    roomId: "Y-0302",
    name: "黄光区",
    cleanClass: "黄光区",
    corridorPressurePa: 4,
    adjacentRoomId: "Y-0301",
    actualDirection: "positive",
    expectedDirection: "positive",
    airlockId: air04.id,
  });
  y0302.versions[0].changedAt = frozenAt;
  y0302.versions[0].changedBy = "班组长-李敏";

  const rooms = [cr1201, cr2107, cr3304, y0302];

  const lowConflictY: Conflict = {
    ruleId: "LOW_CORRIDOR_PRESSURE",
    roomId: y0302.roomId,
    roomLabel: y0302.name,
    airlockName: air04.name,
    corridorPressurePa: 4,
    headcount: 0,
    detail: RULE_DETAILS.LOW_CORRIDOR_PRESSURE,
  };

  const applications: PassageApplication[] = [
    {
      id: uid("app"),
      code: "PASS-260919-001",
      roomRefId: y0302.id,
      airlockId: air04.id,
      applicant: "巡检员-周倩",
      shift: "2026-09-19 C班",
      createdAt: frozenAt,
      status: "released",
      conflicts: [lowConflictY],
      snapshot: {
        roomVersion: 1,
        airlockVersion: 1,
        corridorPressurePa: 4,
        actualDirection: "positive",
        expectedDirection: "positive",
        headcount: 0,
      },
      basis: "黄光机台维护期间临时低差压，现场已挂警示牌并限制开门，确认梯度可在2小时内恢复，班组长复核放行。",
      reviewer: "班组长-李敏",
      releasedAt: frozenAt,
      releaseShift: "2026-09-19 C班",
      releaseKind: "review",
      carries: [],
    },
    {
      id: uid("app"),
      code: "PASS-260920-002",
      roomRefId: cr1201.id,
      airlockId: air01.id,
      applicant: "巡检员-张工",
      shift: "2026-09-20 A班",
      createdAt: "2026-09-20T00:42:00.000Z",
      status: "pending_review",
      conflicts: [
        {
          ruleId: "LOW_CORRIDOR_PRESSURE",
          roomId: cr1201.roomId,
          roomLabel: cr1201.name,
          airlockName: air01.name,
          corridorPressurePa: 3,
          headcount: 2,
          detail: RULE_DETAILS.LOW_CORRIDOR_PRESSURE,
        },
        {
          ruleId: "DIRECTION_INVERTED",
          roomId: cr1201.roomId,
          roomLabel: cr1201.name,
          airlockName: air01.name,
          corridorPressurePa: 3,
          headcount: 2,
          detail: RULE_DETAILS.DIRECTION_INVERTED,
        },
        {
          ruleId: "AIRLOCK_CAPACITY",
          roomId: cr1201.roomId,
          roomLabel: cr1201.name,
          airlockName: air01.name,
          corridorPressurePa: 3,
          headcount: 2,
          detail: RULE_DETAILS.AIRLOCK_CAPACITY,
        },
      ],
      snapshot: {
        roomVersion: 1,
        airlockVersion: 1,
        corridorPressurePa: 3,
        actualDirection: "negative",
        expectedDirection: "positive",
        headcount: 2,
      },
      carries: [],
    },
    {
      id: uid("app"),
      code: "PASS-260919-003",
      roomRefId: cr3304.id,
      airlockId: air03.id,
      applicant: "巡检员-周倩",
      shift: "2026-09-19 C班",
      createdAt: "2026-09-19T23:10:00.000Z",
      status: "deferred",
      conflicts: [
        {
          ruleId: "LOW_CORRIDOR_PRESSURE",
          roomId: cr3304.roomId,
          roomLabel: cr3304.name,
          airlockName: air03.name,
          corridorPressurePa: 4,
          headcount: 0,
          detail: RULE_DETAILS.LOW_CORRIDOR_PRESSURE,
        },
      ],
      snapshot: {
        roomVersion: 1,
        airlockVersion: 1,
        corridorPressurePa: 4,
        actualDirection: "positive",
        expectedDirection: "positive",
        headcount: 0,
      },
      carries: [
        {
          fromShift: "2026-09-19 C班",
          toShift: "2026-09-20 A班",
          at: "2026-09-20T00:00:00.000Z",
        },
      ],
    },
  ];

  return {
    rooms,
    airlocks,
    applications,
    shiftBaseDate: "2026-09-20",
    shiftIndex: 0,
    seq: { application: 3 },
  };
}
