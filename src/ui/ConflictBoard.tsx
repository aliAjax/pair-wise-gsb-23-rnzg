// 冲突面板：固定列出 房间、压差、人数、规则 四列。
import type { Conflict } from "../domain/types";
import { RuleBadge } from "./controls";

export function ConflictBoard({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>规则冲突</p>
          <h2>压差梯度 / 缓冲间冲突</h2>
        </div>
        <span className={conflicts.length > 0 ? "counter danger" : "counter"}>
          {conflicts.length} 条
        </span>
      </div>

      {conflicts.length === 0 ? (
        <p className="empty-hint">当前无冲突：走廊压差均 ≥ 5 Pa、梯度方向正常、缓冲间未满员。</p>
      ) : (
        <div className="table-wrap">
          <table className="conflict-table">
            <thead>
              <tr>
                <th>房间</th>
                <th>走廊压差</th>
                <th>缓冲间人数</th>
                <th>命中规则</th>
                <th>判定说明</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((conflict, index) => (
                <tr key={`${conflict.rule}-${conflict.roomId}-${index}`}>
                  <td className="cell-room">{conflict.roomId}</td>
                  <td>
                    <strong className={conflict.rule === "R1" ? "text-danger" : ""}>
                      {conflict.corridorPressure} Pa
                    </strong>
                  </td>
                  <td>
                    <strong className={conflict.rule === "R3" ? "text-danger" : ""}>
                      {conflict.occupancy} 人
                    </strong>
                  </td>
                  <td>
                    <RuleBadge code={conflict.rule} />
                  </td>
                  <td className="cell-detail">{conflict.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
