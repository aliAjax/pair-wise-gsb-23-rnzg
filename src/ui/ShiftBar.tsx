// 页面层：班次与角色栏（跨班顺延入口）

import { shiftInfo } from "../rules/shift";
import { handoverToNextShift } from "../rules/workflow";
import { repo } from "../data/repository";
import type { Role } from "../data/types";

const ROLES: Role[] = ["巡检员", "厂务工程师", "班组长"];

export function ShiftBar({
  role,
  onRoleChange,
  operator,
  onOperatorChange,
  baseDate,
  shiftIndex,
}: {
  role: Role;
  onRoleChange: (role: Role) => void;
  operator: string;
  onOperatorChange: (v: string) => void;
  baseDate: string;
  shiftIndex: number;
}) {
  const current = shiftInfo(baseDate, shiftIndex);
  const following = shiftInfo(baseDate, shiftIndex + 1);
  const pendingCount = repo
    .getState()
    .applications.filter((a) => a.status !== "released").length;

  return (
    <section className="panel shift-bar">
      <div className="shift-block">
        <span>当前班次</span>
        <strong>{current.label}</strong>
        <p>序号 #{shiftIndex}（每天 A/B/C 三班轮换）</p>
      </div>
      <div className="shift-block">
        <span>待复核 / 顺延</span>
        <strong className={pendingCount > 0 ? "text-danger" : "text-ok"}>
          {pendingCount}
        </strong>
        <p>跨班未复核的申请自动顺延</p>
      </div>
      <div className="shift-block grow">
        <span>当前角色（页面视角）</span>
        <div className="chips compact">
          {ROLES.map((r) => (
            <button
              key={r}
              className={r === role ? "chip-active" : ""}
              onClick={() => onRoleChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <label className="inline-field">
          <span>操作人</span>
          <input
            value={operator}
            onChange={(e) => onOperatorChange(e.target.value)}
            placeholder="如：巡检员-张工"
          />
        </label>
      </div>
      <div className="shift-block">
        <span>班次交接</span>
        <button
          className="primary-action"
          onClick={() => {
            if (
              pendingCount > 0 &&
              !window.confirm(
                `${current.label} 有 ${pendingCount} 张申请未复核，将顺延到 ${following.label}，确认交接？`
              )
            ) {
              return;
            }
            handoverToNextShift();
          }}
        >
          交接至{following.kind}班
        </button>
        <p className="hint">
          交至 {following.label}
          <br />
          <button className="link-btn" onClick={() => repo.reset()}>
            重置演示数据
          </button>
        </p>
      </div>
    </section>
  );
}
