// 页面层：通行申请闭环 —— 待复核填依据、班组长放行、顺延记录、放行版本与冻结快照

import { useEffect, useState } from "react";
import { releaseAfterReview } from "../rules/workflow";
import { DIRECTION_LABELS, RULE_LABELS } from "../rules/pressureRules";
import { shiftInfo } from "../rules/shift";
import type {
  Airlock,
  PassageApplication,
  Role,
  RoomRegistration,
} from "../data/types";

const STATUS_META: Record<
  PassageApplication["status"],
  { label: string; cls: string }
> = {
  pending_review: { label: "待复核", cls: "pill-watch" },
  deferred: { label: "跨班顺延", cls: "pill-deferred" },
  released: { label: "已放行 · 冻结", cls: "pill-ok" },
};

function ApplicationCard({
  app,
  room,
  airlock,
  role,
  operator,
}: {
  app: PassageApplication;
  room?: RoomRegistration;
  airlock?: Airlock;
  role: Role;
  operator: string;
}) {
  const [basis, setBasis] = useState(app.basis ?? "");
  const [error, setError] = useState("");
  const [justReleased, setJustReleased] = useState(false);

  useEffect(() => {
    setBasis(app.basis ?? "");
  }, [app.basis, app.status]);

  const meta = STATUS_META[app.status];
  const snap = app.snapshot;

  // 放行后现场值可能已被补录：对照冻结快照展示差异
  const drift =
    app.status === "released" && room && airlock
      ? [
          room.corridorPressurePa !== snap.corridorPressurePa
            ? `走廊压差 ${snap.corridorPressurePa}Pa → ${room.corridorPressurePa}Pa（v${snap.roomVersion}→v${room.version}）`
            : null,
          airlock.headcount !== snap.headcount
            ? `人数 ${snap.headcount} → ${airlock.headcount}（v${snap.airlockVersion}→v${airlock.version}）`
            : null,
        ].filter(Boolean)
      : [];

  const release = () => {
    setError("");
    try {
      releaseAfterReview({
        applicationId: app.id,
        basis,
        reviewer: operator.includes("班组长") ? operator : "班组长（当前视角）",
      });
      setJustReleased(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "放行失败");
    }
  };

  return (
    <article className={`app-card app-${app.status}`}>
      <header className="app-head">
        <div>
          <h3>{app.code}</h3>
          <p className="sub">
            {room?.roomId ?? "房间已删除"} {room?.name} · 申请人 {app.applicant} · 申请班次{" "}
            {app.shift}
          </p>
        </div>
        <span className={`pill ${meta.cls}`}>{meta.label}</span>
      </header>

      <div className="snapshot-grid">
        <div>
          <span>申请时走廊压差</span>
          <strong className={snap.corridorPressurePa < 5 ? "num-danger" : "num"}>
            {snap.corridorPressurePa}Pa
          </strong>
        </div>
        <div>
          <span>申请时方向</span>
          <strong>
            {DIRECTION_LABELS[snap.actualDirection]}
            {snap.actualDirection !== snap.expectedDirection && (
              <em className="num-danger">
                {" "}
                （要求{DIRECTION_LABELS[snap.expectedDirection]}）
              </em>
            )}
          </strong>
        </div>
        <div>
          <span>申请时缓冲间人数</span>
          <strong className={snap.headcount >= 2 ? "num-danger" : "num"}>
            {snap.headcount}/2
          </strong>
        </div>
        <div>
          <span>冻结版本</span>
          <strong>
            登记 v{snap.roomVersion} / 人数 v{snap.airlockVersion}
          </strong>
        </div>
      </div>

      {app.conflicts.length > 0 && (
        <div className="conflict-tags">
          {app.conflicts.map((c, i) => (
            <span key={`${c.ruleId}-${i}`} className="rule-tag" title={c.detail}>
              {RULE_LABELS[c.ruleId]}
            </span>
          ))}
        </div>
      )}

      {app.status !== "released" && (
        <div className="review-box">
          <label className={basis.trim() ? "" : "reason-required"}>
            <span>复核依据（停在待复核时必填，由班组长放行）</span>
            <textarea
              value={basis}
              rows={3}
              placeholder="说明现场工况、临时措施、恢复时限等放行依据"
              onChange={(e) => setBasis(e.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="room-actions">
            <button
              className="primary-action"
              onClick={release}
              disabled={role !== "班组长"}
              title={role !== "班组长" ? "请将页面角色切换为班组长" : ""}
            >
              {role === "班组长" ? "班组长复核放行并冻结" : "仅班组长可放行（请切换角色）"}
            </button>
          </div>
          {role !== "班组长" && (
            <p className="hint">当前视角为{role}：可登记数据、发起申请，放行权限在班组长。</p>
          )}
        </div>
      )}

      {app.status === "released" && (
        <div className="released-box">
          <p>
            <strong>放行方式：</strong>
            {app.releaseKind === "auto" ? "系统自动放行（无规则冲突）" : "班组长复核放行"}
          </p>
          {app.basis && (
            <p>
              <strong>复核依据：</strong>
              {app.basis}
            </p>
          )}
          <p className="sub">
            放行：{app.reviewer} · {app.releaseShift} ·{" "}
            {app.releasedAt &&
              new Date(app.releasedAt).toLocaleString("zh-CN", { hour12: false })}
          </p>
          {justReleased && (
            <p className="form-ok">已放行：房间压差/方向数据与缓冲间人数即刻冻结。</p>
          )}
          {drift.length > 0 ? (
            <div className="drift-box">
              <p>放行后补录（旧值已保留）：</p>
              <ul>
                {drift.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="hint">放行后无补录，冻结值即当前值。</p>
          )}
        </div>
      )}

      {app.carries.length > 0 && (
        <div className="carry-box">
          <p>跨班顺延记录：</p>
          <ol>
            {app.carries.map((c, i) => (
              <li key={i}>
                {c.fromShift} 未复核 → 顺延至 {c.toShift}（
                {new Date(c.at).toLocaleString("zh-CN", { hour12: false })}）
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

export function PassageDesk({
  applications,
  rooms,
  airlocks,
  role,
  operator,
  baseDate,
  shiftIndex,
  flashCode,
}: {
  applications: PassageApplication[];
  rooms: RoomRegistration[];
  airlocks: Airlock[];
  role: Role;
  operator: string;
  baseDate: string;
  shiftIndex: number;
  flashCode?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "released">("all");
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const airMap = new Map(airlocks.map((a) => [a.id, a]));
  const current = shiftInfo(baseDate, shiftIndex);

  const list = applications
    .filter((a) =>
      filter === "all"
        ? true
        : filter === "open"
          ? a.status !== "released"
          : a.status === "released"
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const openFromOtherShift = applications.filter(
    (a) => a.status !== "released" && a.shift !== current.label
  ).length;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>通行闭环（申请 → 待复核/顺延 → 放行冻结 → 补录新版本）</p>
          <h2>缓冲间通行申请</h2>
        </div>
        <div className="chips compact">
          <button
            className={filter === "all" ? "chip-active" : ""}
            onClick={() => setFilter("all")}
          >
            全部
          </button>
          <button
            className={filter === "open" ? "chip-active" : ""}
            onClick={() => setFilter("open")}
          >
            待复核/顺延
          </button>
          <button
            className={filter === "released" ? "chip-active" : ""}
            onClick={() => setFilter("released")}
          >
            已放行
          </button>
        </div>
      </div>

      {openFromOtherShift > 0 && (
        <p className="carry-banner">
          {openFromOtherShift} 张申请跨班未复核，已顺延至当前班次 {current.label}，需继续复核。
        </p>
      )}

      {list.length === 0 ? (
        <p className="empty-hint">当前筛选下暂无申请。</p>
      ) : (
        <div className="app-list">
          {list.map((app) => (
            <div
              key={app.id}
              className={flashCode === app.code ? "flash-wrap" : ""}
            >
              <ApplicationCard
                app={app}
                room={roomMap.get(app.roomRefId)}
                airlock={airMap.get(app.airlockId)}
                role={role}
                operator={operator}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
