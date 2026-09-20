import { useEffect, useMemo, useReducer, useState } from "react";
import "./styles.css";
import { loadState, reducer, saveState } from "./data/store";
import {
  BUFFER_LIMIT,
  MIN_CORRIDOR_PRESSURE,
  carriedInto,
  evaluateConflicts,
} from "./domain/rules";
import type { Role, ShiftId } from "./domain/types";
import { ConflictBoard } from "./ui/ConflictBoard";
import { RoomRegistry } from "./ui/RoomRegistry";
import { PassageFlow } from "./ui/PassageFlow";

const project = {
  id: "hxwl-09",
  port: 5109,
  title: "半导体洁净室巡检",
  subtitle: "压差梯度判定、缓冲间通行闭环与跨班顺延复核看板",
  stack: "React + Vite + TypeScript + CSS",
};

const ROLES: Role[] = ["巡检员", "厂务工程师", "班组长"];
const SHIFTS: ShiftId[] = ["白班", "夜班"];
const ISO_FILTERS = ["ISO 5", "ISO 6", "ISO 7", "黄光区"];

const statusTones = ["tone-ok", "tone-r1", "tone-r2", "tone-r3"];

function MetricCard({
  label,
  value,
  unit,
  index,
}: {
  label: string;
  value: number;
  unit: string;
  index: number;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <i className={statusTones[index % statusTones.length]} />
    </article>
  );
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const conflicts = useMemo(() => evaluateConflicts(state), [state]);
  const pending = state.requests.filter((item) => item.status === "待复核");
  const carriedCount = pending.filter((item) => carriedInto(item, state.currentShift)).length;

  const metrics = [
    {
      label: `走廊压差 < ${MIN_CORRIDOR_PRESSURE} Pa`,
      value: conflicts.filter((c) => c.rule === "R1").length,
      unit: "间",
    },
    {
      label: "梯度方向倒置",
      value: conflicts.filter((c) => c.rule === "R2").length,
      unit: "间",
    },
    {
      label: `缓冲间达 ${BUFFER_LIMIT} 人`,
      value: conflicts.filter((c) => c.rule === "R3").length,
      unit: "间",
    },
    {
      label: "待复核（含跨班顺延）",
      value: pending.length,
      unit: carriedCount > 0 ? `件 · ${carriedCount} 件顺延` : "件",
    },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈 / 分层</span>
          <strong>{project.stack}</strong>
          <p>数据（data）· 判定（domain）· 页面（ui）</p>
        </div>
      </section>

      {notice && (
        <div className="notice-bar" role="status">
          {notice}
        </div>
      )}

      <section className="metrics-grid">
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            unit={metric.unit}
            index={index}
          />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>当前班次</h2>
          <div className="chips">
            {SHIFTS.map((shift) => (
              <button
                key={shift}
                className={state.currentShift === shift ? "chip-active" : ""}
                onClick={() => {
                  if (shift !== state.currentShift) {
                    dispatch({ type: "switchShift", toShift: shift });
                    setNotice(`已切换到${shift}：未复核申请自动顺延并记录`);
                  }
                }}
              >
                {shift}
              </button>
            ))}
          </div>

          <h2>当前角色</h2>
          <div className="chips">
            {ROLES.map((role) => (
              <button
                key={role}
                className={state.currentRole === role ? "chip-active" : ""}
                onClick={() => dispatch({ type: "setRole", role })}
              >
                {role}
              </button>
            ))}
          </div>

          <h2>房间筛选</h2>
          <div className="chips muted">
            {ISO_FILTERS.map((filter) => (
              <button key={filter} disabled>
                {filter}
              </button>
            ))}
          </div>

          <h2>规则口径</h2>
          <ul className="rule-list">
            <li>R1 走廊压差低于 {MIN_CORRIDOR_PRESSURE} Pa → 待复核</li>
            <li>R2 相邻房间压差方向倒置 → 待复核</li>
            <li>R3 缓冲间在室达到 {BUFFER_LIMIT} 人 → 待复核</li>
            <li>放行后冻结读数与人数，补录生成带原因新版本</li>
            <li>跨班未复核自动顺延到下一班</li>
          </ul>

          <button
            className="reset-button"
            onClick={() => {
              if (window.confirm("恢复为种子演示数据？当前变更将被清除。")) {
                dispatch({ type: "resetSeed" });
                setNotice("已恢复演示数据");
              }
            }}
          >
            恢复演示数据
          </button>
        </aside>

        <div className="main-column">
          <RoomRegistry state={state} dispatch={dispatch} />
        </div>
      </section>

      <ConflictBoard conflicts={conflicts} />
      <PassageFlow state={state} dispatch={dispatch} onNotice={setNotice} />
    </main>
  );
}

export default App;
