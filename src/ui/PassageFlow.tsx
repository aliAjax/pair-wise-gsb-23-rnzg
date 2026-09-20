// 通行闭环：提交申请（填依据）→ 待复核（班组长放行）→ 冻结版本 → 补录新版本。
import { useMemo, useState } from "react";
import type { Action } from "../data/store";
import {
  DIRECTION_LABELS,
  conflictsForRoom,
} from "../domain/rules";
import type {
  AppState,
  Direction,
  FrozenSnapshot,
  PassageRequest,
} from "../domain/types";
import { NumberField, RuleBadge, StatusBadge, formatTime } from "./controls";

const DIRECTIONS: Direction[] = ["higher", "lower"];

function Readout({ snapshot }: { snapshot: FrozenSnapshot }) {
  return (
    <dl className="readout">
      <div>
        <dt>走廊压差</dt>
        <dd>{snapshot.corridorPressure} Pa</dd>
      </div>
      <div>
        <dt>相邻房间</dt>
        <dd>{snapshot.adjacentId}</dd>
      </div>
      <div>
        <dt>实测方向</dt>
        <dd>{DIRECTION_LABELS[snapshot.observedDirection]}</dd>
      </div>
      <div>
        <dt>相邻压差</dt>
        <dd>{snapshot.adjacentPressure} Pa</dd>
      </div>
      <div>
        <dt>缓冲间</dt>
        <dd>{snapshot.bufferRoomId}</dd>
      </div>
      <div>
        <dt>在室人数</dt>
        <dd>{snapshot.occupancy} 人</dd>
      </div>
    </dl>
  );
}

// ---------- 提交申请 ----------

function SubmitPanel({
  state,
  dispatch,
  onNotice,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  onNotice: (text: string) => void;
}) {
  const canSubmit = state.currentRole === "巡检员" || state.currentRole === "厂务工程师";
  const [roomId, setRoomId] = useState(state.rooms[0]?.id ?? "");
  const [basis, setBasis] = useState("");

  const liveConflicts = useMemo(
    () => conflictsForRoom(state, roomId),
    [state, roomId]
  );

  const submit = () => {
    if (!roomId) return;
    if (basis.trim() === "") {
      onNotice("请先填写通行依据（作业单/事由）");
      return;
    }
    dispatch({ type: "submitRequest", roomId, basis });
    setBasis("");
    if (liveConflicts.length > 0) {
      onNotice(`申请已停在待复核：命中 ${liveConflicts.map((c) => c.rule).join("、")}，等待班组长放行`);
    } else {
      onNotice("无规则冲突，申请已由班组长直接放行并冻结读数");
    }
  };

  return (
    <div className="flow-block">
      <h3>① 通行申请</h3>
      <div className="submit-grid">
        <label>
          <span>通行房间</span>
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {state.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.id} · {room.isoClass}
              </option>
            ))}
          </select>
        </label>
        <label className="basis-field">
          <span>通行依据（必填：作业单号 / 通行事由）</span>
          <textarea
            rows={2}
            placeholder="例如：设备搬入作业单 EQ-MOVE-2207"
            value={basis}
            disabled={!canSubmit}
            onChange={(event) => setBasis(event.target.value)}
          />
        </label>
      </div>
      <div className="submit-foot">
        <div className="hit-list">
          {liveConflicts.length === 0 ? (
            <span className="ok-text">当前读数无冲突，可直接放行</span>
          ) : (
            liveConflicts.map((hit) => <RuleBadge key={hit.rule} code={hit.rule} />)
          )}
        </div>
        <button className="primary-action" disabled={!canSubmit} onClick={submit}>
          提交通行申请
        </button>
      </div>
      {!canSubmit && <p className="form-hint">当前为班组长视角：申请由巡检员/厂务工程师提交，班组长负责复核放行。</p>}
    </div>
  );
}

// ---------- 待复核队列 ----------

function ReviewQueue({
  state,
  dispatch,
  onNotice,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  onNotice: (text: string) => void;
}) {
  const pending = state.requests.filter((item) => item.status === "待复核");
  const canRelease = state.currentRole === "班组长";
  const [notes, setNotes] = useState<Record<string, string>>({});

  const release = (request: PassageRequest) => {
    const note = (notes[request.id] ?? "").trim();
    if (!note) {
      onNotice("请先填写复核依据，再执行班组长放行");
      return;
    }
    dispatch({ type: "releaseRequest", id: request.id, note });
    onNotice(`申请 ${request.id} 已放行，读数与人数已冻结为 v1`);
    setNotes((prev) => {
      const next = { ...prev };
      delete next[request.id];
      return next;
    });
  };

  return (
    <div className="flow-block">
      <h3>② 待复核队列（{pending.length}）</h3>
      {pending.length === 0 ? (
        <p className="empty-hint">没有停在待复核的通行申请。</p>
      ) : (
        <div className="card-list">
          {pending.map((request) => {
            const carried = request.carryovers.some(
              (carry) => carry.toShift === state.currentShift
            );
            const live = conflictsForRoom(state, request.roomId);
            return (
              <article key={request.id} className="flow-card hold-card">
                <header>
                  <div>
                    <strong className="card-title">{request.id}</strong>
                    <StatusBadge status={request.status} />
                    {carried && <span className="carry-badge">跨班顺延</span>}
                  </div>
                  <span className="card-meta">
                    {request.roomId} · {request.createdShift} · {formatTime(request.createdAt)}
                  </span>
                </header>

                <p className="basis-line">
                  <span>通行依据</span>
                  {request.basis}
                </p>

                <div className="hit-list">
                  {request.submitConflicts.length === 0 ? (
                    <span className="ok-text">提交时无冲突</span>
                  ) : (
                    request.submitConflicts.map((code) => <RuleBadge key={code} code={code} />)
                  )}
                </div>

                <details>
                  <summary>提交时冻结读数</summary>
                  <Readout snapshot={request.submitReadings} />
                </details>

                {request.carryovers.length > 0 && (
                  <p className="carry-line">
                    顺延链：
                    {request.carryovers
                      .map((c) => `${c.fromShift} → ${c.toShift}（${formatTime(c.at)}）`)
                      .join("，")}
                  </p>
                )}

                <p className="recheck-line">
                  当前实时判定：
                  {live.length === 0 ? (
                    <span className="ok-text">冲突已消除，仍需班组长确认放行</span>
                  ) : (
                    <span className="text-danger">{live.map((c) => c.rule).join("、")} 仍命中</span>
                  )}
                </p>

                <label className="note-field">
                  <span>复核依据 / 放行说明</span>
                  <textarea
                    rows={2}
                    disabled={!canRelease}
                    placeholder="例如：已现场确认门连锁恢复，压差 12 Pa，允许一人通过"
                    value={notes[request.id] ?? ""}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [request.id]: event.target.value }))
                    }
                  />
                </label>
                <div className="card-actions">
                  <button
                    className="primary-action"
                    disabled={!canRelease}
                    onClick={() => release(request)}
                  >
                    班组长放行并冻结
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- 已放行与补录 ----------

function AmendForm({
  request,
  dispatch,
  onNotice,
}: {
  request: PassageRequest;
  dispatch: (action: Action) => void;
  onNotice: (text: string) => void;
}) {
  const latest = request.versions[request.versions.length - 1].readings;
  const [corridor, setCorridor] = useState(latest.corridorPressure);
  const [adjacent, setAdjacent] = useState(latest.adjacentPressure);
  const [observed, setObserved] = useState<Direction>(latest.observedDirection);
  const [occupancy, setOccupancy] = useState(latest.occupancy);
  const [reason, setReason] = useState("");

  const submit = () => {
    if (reason.trim() === "") {
      onNotice("补录必须填写原因，旧值会原样保留");
      return;
    }
    const readings: FrozenSnapshot = {
      ...latest,
      corridorPressure: corridor,
      adjacentPressure: adjacent,
      observedDirection: observed,
      occupancy,
    };
    dispatch({ type: "amendRequest", id: request.id, readings, reason });
    setReason("");
    onNotice(`${request.id} 已生成 v${request.currentVersion + 1}，v${request.currentVersion} 旧值保留`);
  };

  return (
    <div className="amend-form">
      <div className="amend-grid">
        <label>
          <span>走廊压差</span>
          <NumberField value={corridor} suffix="Pa" onCommit={setCorridor} />
        </label>
        <label>
          <span>实测方向</span>
          <select value={observed} onChange={(e) => setObserved(e.target.value as Direction)}>
            {DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {DIRECTION_LABELS[direction]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>相邻压差</span>
          <NumberField value={adjacent} suffix="Pa" min={0} onCommit={setAdjacent} />
        </label>
        <label>
          <span>缓冲间人数</span>
          <NumberField value={occupancy} min={0} max={2} onCommit={setOccupancy} />
        </label>
      </div>
      <label className="basis-field">
        <span>补录原因（必填，随新版本保存）</span>
        <textarea
          rows={2}
          placeholder="例如：走廊压差表复核，由 15 Pa 更正为 16 Pa"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button onClick={submit}>保存为 v{request.currentVersion + 1}（保留 v{request.currentVersion} 旧值）</button>
    </div>
  );
}

function ReleasedList({
  state,
  dispatch,
  onNotice,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  onNotice: (text: string) => void;
}) {
  const released = state.requests.filter((item) => item.status === "已放行");
  const [openAmend, setOpenAmend] = useState<string | null>(null);
  const canAmend = state.currentRole === "巡检员" || state.currentRole === "厂务工程师";

  return (
    <div className="flow-block">
      <h3>③ 已放行版本（{released.length}）</h3>
      {released.length === 0 ? (
        <p className="empty-hint">暂无放行记录。</p>
      ) : (
        <div className="card-list">
          {released.map((request) => (
            <article key={request.id} className="flow-card released-card">
              <header>
                <div>
                  <strong className="card-title">{request.id}</strong>
                  <StatusBadge status={request.status} />
                  <span className="version-badge">当前 v{request.currentVersion}</span>
                </div>
                <span className="card-meta">
                  {request.roomId} · {request.releaseShift} 放行 · {formatTime(request.releasedAt!)}
                </span>
              </header>
              <p className="basis-line">
                <span>放行依据</span>
                {request.reviewNote}
              </p>

              <div className="version-timeline">
                {request.versions.map((version) => {
                  const isLatest = version.version === request.currentVersion;
                  return (
                    <details key={version.version} className={isLatest ? "version latest" : "version"}>
                      <summary>
                        <strong>
                          v{version.version}
                          {version.version === 1 ? " · 放行冻结" : " · 补录"}
                        </strong>
                        <span>
                          {version.shift} · {version.createdByRole} · {formatTime(version.createdAt)}
                        </span>
                      </summary>
                      <p className="version-reason">{version.reason}</p>
                      <Readout snapshot={version.readings} />
                    </details>
                  );
                })}
              </div>

              {canAmend ? (
                <>
                  <button
                    className="link-button"
                    onClick={() => setOpenAmend(openAmend === request.id ? null : request.id)}
                  >
                    {openAmend === request.id ? "收起补录" : "补录读数（生成带原因的新版本）"}
                  </button>
                  {openAmend === request.id && (
                    <AmendForm
                      key={request.id}
                      request={request}
                      dispatch={dispatch}
                      onNotice={onNotice}
                    />
                  )}
                </>
              ) : (
                <p className="form-hint">放行后数据已冻结；班组长如需修改请切换到巡检员/厂务工程师补录新版本。</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function PassageFlow({
  state,
  dispatch,
  onNotice,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  onNotice: (text: string) => void;
}) {
  return (
    <section className="panel flow-panel">
      <div className="section-heading">
        <div>
          <p>缓冲间通行闭环</p>
          <h2>申请 · 待复核 · 放行冻结 · 补录版本</h2>
        </div>
      </div>
      <SubmitPanel state={state} dispatch={dispatch} onNotice={onNotice} />
      <ReviewQueue state={state} dispatch={dispatch} onNotice={onNotice} />
      <ReleasedList state={state} dispatch={dispatch} onNotice={onNotice} />
    </section>
  );
}
