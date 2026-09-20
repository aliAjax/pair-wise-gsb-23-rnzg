// 页面层：实时冲突清单 —— 列出房间、压差、人数和命中规则

import { RULE_LABELS, evaluateAll } from "../rules/pressureRules";
import type { Airlock, RoomRegistration } from "../data/types";

export function ConflictBoard({
  rooms,
  airlocks,
  onPickRoom,
}: {
  rooms: RoomRegistration[];
  airlocks: Airlock[];
  onPickRoom: (roomRefId: string) => void;
}) {
  const conflicts = evaluateAll(rooms, airlocks);

  return (
    <section className="panel conflict-board">
      <div className="section-heading">
        <div>
          <p>规则判定（判定层纯函数实时计算）</p>
          <h2>压差梯度与缓冲间冲突</h2>
        </div>
        <span className={`pill ${conflicts.length ? "pill-danger" : "pill-ok"}`}>
          {conflicts.length ? `${conflicts.length} 项命中` : "全部正常"}
        </span>
      </div>

      {conflicts.length === 0 ? (
        <p className="empty-hint">
          走廊压差 ≥ 5Pa、方向无倒置、缓冲间未满员，通行申请将自动放行。
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>房间</th>
                <th>走廊压差</th>
                <th>缓冲间人数</th>
                <th>命中规则</th>
                <th>说明</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c, i) => (
                <tr key={`${c.roomId}-${c.ruleId}-${i}`}>
                  <td>
                    <strong>{c.roomId}</strong>
                    <span className="sub">{c.roomLabel}</span>
                  </td>
                  <td>
                    <span
                      className={
                        c.ruleId === "LOW_CORRIDOR_PRESSURE"
                          ? "num-danger"
                          : "num"
                      }
                    >
                      {c.corridorPressurePa} Pa
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        c.ruleId === "AIRLOCK_CAPACITY"
                          ? "num-danger"
                          : "num"
                      }
                    >
                      {c.headcount}/2
                    </span>
                    <span className="sub">{c.airlockName}</span>
                  </td>
                  <td>
                    <span className="rule-tag">{RULE_LABELS[c.ruleId]}</span>
                  </td>
                  <td className="detail-cell">{c.detail}</td>
                  <td>
                    <button
                      className="link-btn"
                      onClick={() => {
                        const reg = rooms.find((r) => r.roomId === c.roomId);
                        if (reg) onPickRoom(reg.id);
                      }}
                    >
                      去申请
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
