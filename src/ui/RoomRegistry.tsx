// 页面层：房间登记（走廊压差 / 相邻房间压差方向 / 缓冲间人数）+ 补录版本 + 发起通行申请

import { useEffect, useMemo, useState } from "react";
import { repo } from "../data/repository";
import { submitPassage } from "../rules/workflow";
import {
  DIRECTION_LABELS,
  RULE_LABELS,
  evaluate,
} from "../rules/pressureRules";
import type {
  Airlock,
  Direction,
  Role,
  RoomRegistration,
} from "../data/types";

interface AmendDraft {
  corridorPressurePa: string;
  adjacentRoomId: string;
  actualDirection: Direction;
  expectedDirection: Direction;
  headcount: string;
  reason: string;
}

function draftFrom(room: RoomRegistration, airlock?: Airlock): AmendDraft {
  return {
    corridorPressurePa: String(room.corridorPressurePa),
    adjacentRoomId: room.adjacentRoomId,
    actualDirection: room.actualDirection,
    expectedDirection: room.expectedDirection,
    headcount: String(airlock ? airlock.headcount : 0),
    reason: "",
  };
}

function RoomCard({
  room,
  airlock,
  role,
  operator,
  expanded,
  onToggle,
  onApplied,
}: {
  room: RoomRegistration;
  airlock?: Airlock;
  role: Role;
  operator: string;
  expanded: boolean;
  onToggle: () => void;
  onApplied: (code: string) => void;
}) {
  const conflicts = evaluate(room, airlock);
  const roomFrozen = repo.isRoomFrozen(room.id);
  const airlockFrozen = airlock ? repo.isAirlockFrozen(airlock.id) : false;
  const frozen = roomFrozen || airlockFrozen;
  const [draft, setDraft] = useState<AmendDraft>(() => draftFrom(room, airlock));
  const [error, setError] = useState("");

  const set = (patch: Partial<AmendDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const saveAmend = () => {
    setError("");
    try {
      const pressure = Number(draft.corridorPressurePa);
      const headcount = Number(draft.headcount);
      if (!Number.isFinite(pressure)) throw new Error("走廊压差需为数字");
      if (!Number.isFinite(headcount) || headcount < 0) {
        throw new Error("缓冲间人数需为非负整数");
      }
      repo.amendRoom(
        room.id,
        {
          corridorPressurePa: pressure,
          adjacentRoomId: draft.adjacentRoomId.trim() || room.adjacentRoomId,
          actualDirection: draft.actualDirection,
          expectedDirection: draft.expectedDirection,
          headcount,
          reason: draft.reason,
        },
        operator || "未署名"
      );
      setDraft((d) => ({ ...d, reason: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "补录失败");
    }
  };

  const apply = () => {
    setError("");
    try {
      const { application } = submitPassage({
        roomRefId: room.id,
        applicant: operator,
      });
      onApplied(application.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "申请失败");
    }
  };

  return (
    <article className={`room-card ${frozen ? "frozen" : ""}`}>
      <header className="room-head" onClick={onToggle}>
        <div>
          <h3>
            {room.roomId} <span className="room-name">{room.name}</span>
          </h3>
          <p className="sub">
            {room.cleanClass} · 相邻 {room.adjacentRoomId} · {airlock?.name ?? "未分配缓冲间"}
          </p>
        </div>
        <div className="room-head-right">
          <div className="kv">
            <span>走廊压差</span>
            <strong className={room.corridorPressurePa < 5 ? "num-danger" : "num"}>
              {room.corridorPressurePa}Pa
            </strong>
          </div>
          <div className="kv">
            <span>缓冲间人数</span>
            <strong className={(airlock?.headcount ?? 0) >= 2 ? "num-danger" : "num"}>
              {airlock?.headcount ?? 0}/2
            </strong>
          </div>
          <div className="kv">
            <span>版本</span>
            <strong>
              v{room.version}
              {(airlock?.version ?? 1) > 1 ? ` / 人v${airlock?.version}` : ""}
            </strong>
          </div>
          {frozen && <span className="pill pill-frozen">已冻结</span>}
          <span className="chev">{expanded ? "收起 ▲" : "展开 ▼"}</span>
        </div>
      </header>

      {conflicts.length > 0 && (
        <div className="conflict-tags">
          {conflicts.map((c) => (
            <span key={c.ruleId} className="rule-tag">
              {RULE_LABELS[c.ruleId]}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="room-body">
          <div className="form-grid">
            <label>
              <span>走廊压差 Pa（下限 5Pa）</span>
              <input
                type="number"
                value={draft.corridorPressurePa}
                onChange={(e) => set({ corridorPressurePa: e.target.value })}
              />
            </label>
            <label>
              <span>相邻房间编号</span>
              <input
                value={draft.adjacentRoomId}
                onChange={(e) => set({ adjacentRoomId: e.target.value })}
              />
            </label>
            <label>
              <span>实测压差方向</span>
              <select
                value={draft.actualDirection}
                onChange={(e) => set({ actualDirection: e.target.value as Direction })}
              >
                <option value="positive">{DIRECTION_LABELS.positive}</option>
                <option value="negative">{DIRECTION_LABELS.negative}</option>
              </select>
            </label>
            <label>
              <span>梯度要求方向</span>
              <select
                value={draft.expectedDirection}
                onChange={(e) =>
                  set({ expectedDirection: e.target.value as Direction })
                }
              >
                <option value="positive">{DIRECTION_LABELS.positive}</option>
                <option value="negative">{DIRECTION_LABELS.negative}</option>
              </select>
            </label>
            <label>
              <span>缓冲间人数（{airlock?.name ?? "—"}）</span>
              <input
                type="number"
                min={0}
                max={2}
                value={draft.headcount}
                onChange={(e) => set({ headcount: e.target.value })}
              />
            </label>
            <label className={frozen ? "reason-required" : ""}>
              <span>
                补录原因{frozen ? "（冻结后必填，旧值保留）" : "（放行前修订可不填）"}
              </span>
              <input
                value={draft.reason}
                placeholder={frozen ? "如：风机恢复后据实补录" : "未冻结数据直接更新，不留新版本"}
                onChange={(e) => set({ reason: e.target.value })}
              />
            </label>
          </div>

          {frozen && (
            <p className="frozen-note">
              该房间存在已放行申请：压差/方向数据与缓冲间人数已冻结。修改只生成带原因的新版本，历史旧值完整保留在下方版本链。
            </p>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="room-actions">
            <button onClick={saveAmend} disabled={role === "班组长"}>
              {frozen ? "提交补录（新版本）" : "保存登记修订"}
            </button>
            <button className="primary-action" onClick={apply} disabled={role === "班组长"}>
              {conflicts.length === 0 ? "发起通行申请（可自动放行）" : "发起通行申请（将停在待复核）"}
            </button>
          </div>

          <VersionHistory room={room} airlock={airlock} />
        </div>
      )}
    </article>
  );
}

function VersionHistory({
  room,
  airlock,
}: {
  room: RoomRegistration;
  airlock?: Airlock;
}) {
  const rows = useMemo(() => {
    const r = room.versions.map((v) => ({
      key: `r${v.version}`,
      kind: `登记 v${v.version}`,
      pressure: `${v.corridorPressurePa}Pa`,
      direction: `${DIRECTION_LABELS[v.actualDirection]} / 要求${DIRECTION_LABELS[v.expectedDirection]}`,
      headcount: "—",
      reason: v.reason ?? "（初版登记）",
      at: v.changedAt,
      by: v.changedBy,
    }));
    const a = (airlock?.versions ?? [])
      .filter((v) => v.version > 1 || room.versions.length > 0)
      .map((v) => ({
        key: `a${v.version}`,
        kind: `人数 v${v.version}`,
        pressure: "—",
        direction: "—",
        headcount: `${v.headcount}/2`,
        reason: v.reason ?? "（初版）",
        at: v.changedAt,
        by: v.changedBy,
      }));
    return [...r, ...a].sort((x, y) => (x.at < y.at ? 1 : -1));
  }, [room, airlock]);

  return (
    <details className="history">
      <summary>版本链与旧值（{rows.length} 条）</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>版本</th>
              <th>走廊压差</th>
              <th>方向（实测/要求）</th>
              <th>人数</th>
              <th>原因</th>
              <th>时间/操作人</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.kind}</td>
                <td>{row.pressure}</td>
                <td>{row.direction}</td>
                <td>{row.headcount}</td>
                <td>{row.reason}</td>
                <td className="sub">
                  {new Date(row.at).toLocaleString("zh-CN", { hour12: false })}
                  <br />
                  {row.by}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function RoomRegistry({
  rooms,
  airlocks,
  role,
  operator,
  pickedRoom,
  onPickedHandled,
  onApplied,
}: {
  rooms: RoomRegistration[];
  airlocks: Airlock[];
  role: Role;
  operator: string;
  pickedRoom: string | null;
  onPickedHandled: () => void;
  onApplied: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    rooms.reduce<Record<string, boolean>>((acc, r) => {
      acc[r.id] = true;
      return acc;
    }, {})
  );
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({
    roomId: "",
    name: "",
    cleanClass: "ISO 7",
    corridorPressurePa: "10",
    adjacentRoomId: "",
    actualDirection: "positive" as Direction,
    expectedDirection: "positive" as Direction,
    airlockId: airlocks[0]?.id ?? "",
    newAirlockName: "",
  });
  const [registerError, setRegisterError] = useState("");

  useEffect(() => {
    if (pickedRoom) {
      setExpanded((e) => ({ ...e, [pickedRoom]: true }));
      onPickedHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedRoom]);

  const airMap = new Map(airlocks.map((a) => [a.id, a]));

  const register = () => {
    setRegisterError("");
    try {
      if (!form.roomId.trim()) throw new Error("房间编号必填");
      if (rooms.some((r) => r.roomId === form.roomId.trim())) {
        throw new Error("该房间编号已登记");
      }
      let airlockId = form.airlockId;
      if (!airlockId) {
        const name = form.newAirlockName.trim() || `AIR-${form.roomId.trim()} 缓冲间`;
        airlockId = repo.registerAirlock(name).id;
      }
      repo.registerRoom({
        roomId: form.roomId.trim(),
        name: form.name.trim() || "未命名房间",
        cleanClass: form.cleanClass,
        corridorPressurePa: Number(form.corridorPressurePa),
        adjacentRoomId: form.adjacentRoomId.trim() || "走廊",
        actualDirection: form.actualDirection,
        expectedDirection: form.expectedDirection,
        airlockId,
      });
      setShowRegister(false);
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : "登记失败");
    }
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>房间登记（数据层）</p>
          <h2>压差梯度 · 相邻方向 · 缓冲间人数</h2>
        </div>
        <button className="primary-action" onClick={() => setShowRegister((v) => !v)}>
          {showRegister ? "取消" : "登记新房间"}
        </button>
      </div>

      {showRegister && (
        <div className="register-box">
          <div className="form-grid">
            <label>
              <span>房间编号</span>
              <input
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                placeholder="如 CR-4101"
              />
            </label>
            <label>
              <span>房间名称</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              <span>洁净等级</span>
              <select
                value={form.cleanClass}
                onChange={(e) => setForm({ ...form, cleanClass: e.target.value })}
              >
                <option>ISO 5</option>
                <option>ISO 6</option>
                <option>ISO 7</option>
                <option>黄光区</option>
              </select>
            </label>
            <label>
              <span>走廊压差 Pa</span>
              <input
                type="number"
                value={form.corridorPressurePa}
                onChange={(e) =>
                  setForm({ ...form, corridorPressurePa: e.target.value })
                }
              />
            </label>
            <label>
              <span>相邻房间编号</span>
              <input
                value={form.adjacentRoomId}
                onChange={(e) =>
                  setForm({ ...form, adjacentRoomId: e.target.value })
                }
              />
            </label>
            <label>
              <span>实测方向</span>
              <select
                value={form.actualDirection}
                onChange={(e) =>
                  setForm({ ...form, actualDirection: e.target.value as Direction })
                }
              >
                <option value="positive">{DIRECTION_LABELS.positive}</option>
                <option value="negative">{DIRECTION_LABELS.negative}</option>
              </select>
            </label>
            <label>
              <span>要求方向</span>
              <select
                value={form.expectedDirection}
                onChange={(e) =>
                  setForm({ ...form, expectedDirection: e.target.value as Direction })
                }
              >
                <option value="positive">{DIRECTION_LABELS.positive}</option>
                <option value="negative">{DIRECTION_LABELS.negative}</option>
              </select>
            </label>
            <label>
              <span>缓冲间</span>
              <select
                value={form.airlockId}
                onChange={(e) => setForm({ ...form, airlockId: e.target.value })}
              >
                <option value="">新建缓冲间…</option>
                {airlocks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.headcount}/2）
                  </option>
                ))}
              </select>
            </label>
            {!form.airlockId && (
              <label>
                <span>新缓冲间名称</span>
                <input
                  value={form.newAirlockName}
                  onChange={(e) =>
                    setForm({ ...form, newAirlockName: e.target.value })
                  }
                  placeholder="留空自动生成"
                />
              </label>
            )}
          </div>
          {registerError && <p className="form-error">{registerError}</p>}
          <div className="room-actions">
            <button className="primary-action" onClick={register}>
              确认登记
            </button>
          </div>
        </div>
      )}

      <div className="room-list">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            airlock={airMap.get(room.airlockId)}
            role={role}
            operator={operator}
            expanded={!!expanded[room.id]}
            onToggle={() =>
              setExpanded((e) => ({ ...e, [room.id]: !e[room.id] }))
            }
            onApplied={onApplied}
          />
        ))}
      </div>
    </section>
  );
}
