// 房间登记：走廊压差、相邻房间方向、缓冲间人数。
import { DIRECTION_LABELS } from "../domain/rules";
import type { Action } from "../data/store";
import type { AppState, Direction } from "../domain/types";
import { NumberField, OccupancyStepper, RuleBadge } from "./controls";
import { conflictsForRoom } from "../domain/rules";

const DIRECTIONS: Direction[] = ["higher", "lower"];

export function RoomRegistry({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
}) {
  const canEdit = state.currentRole === "巡检员" || state.currentRole === "厂务工程师";

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>压差梯度登记</p>
          <h2>房间登记走廊压差、相邻方向与缓冲间人数</h2>
        </div>
      </div>

      <div className="table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th>房间 / 等级</th>
              <th>走廊压差</th>
              <th>相邻房间</th>
              <th>设计方向</th>
              <th>实测方向 / 压差</th>
              <th>缓冲间人数</th>
              <th>实时命中</th>
            </tr>
          </thead>
          <tbody>
            {state.rooms.map((room) => {
              const buffer = state.buffers.find((item) => item.id === room.bufferRoomId);
              const hits = conflictsForRoom(state, room.id);
              return (
                <tr key={room.id}>
                  <td className="cell-room">
                    <strong>{room.id}</strong>
                    <span className="iso-tag">{room.isoClass}</span>
                  </td>
                  <td>
                    <NumberField
                      value={room.corridorPressure}
                      suffix="Pa"
                      disabled={!canEdit}
                      ariaLabel={`${room.id} 走廊压差`}
                      onCommit={(next) =>
                        dispatch({
                          type: "updateRoom",
                          id: room.id,
                          patch: { corridorPressure: next },
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="cell-select"
                      value={room.adjacentId}
                      disabled={!canEdit}
                      aria-label={`${room.id} 相邻房间`}
                      onChange={(event) =>
                        dispatch({
                          type: "updateRoom",
                          id: room.id,
                          patch: { adjacentId: event.target.value },
                        })
                      }
                    >
                      {state.rooms
                        .filter((other) => other.id !== room.id)
                        .map((other) => (
                          <option key={other.id} value={other.id}>
                            {other.id}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="cell-select"
                      value={room.expectedDirection}
                      disabled={!canEdit}
                      aria-label={`${room.id} 设计方向`}
                      onChange={(event) =>
                        dispatch({
                          type: "updateRoom",
                          id: room.id,
                          patch: { expectedDirection: event.target.value as Direction },
                        })
                      }
                    >
                      {DIRECTIONS.map((direction) => (
                        <option key={direction} value={direction}>
                          {DIRECTION_LABELS[direction]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="dir-group">
                      <select
                        className="cell-select"
                        value={room.observedDirection}
                        disabled={!canEdit}
                        aria-label={`${room.id} 实测方向`}
                        onChange={(event) =>
                          dispatch({
                            type: "updateRoom",
                            id: room.id,
                            patch: { observedDirection: event.target.value as Direction },
                          })
                        }
                      >
                        {DIRECTIONS.map((direction) => (
                          <option key={direction} value={direction}>
                            {DIRECTION_LABELS[direction]}
                          </option>
                        ))}
                      </select>
                      <NumberField
                        value={room.adjacentPressure}
                        suffix="Pa"
                        min={0}
                        disabled={!canEdit}
                        ariaLabel={`${room.id} 相邻压差`}
                        onCommit={(next) =>
                          dispatch({
                            type: "updateRoom",
                            id: room.id,
                            patch: { adjacentPressure: next },
                          })
                        }
                      />
                    </div>
                  </td>
                  <td>
                    <div className="buffer-group">
                      <span className="buffer-name">{buffer?.name ?? room.bufferRoomId}</span>
                      <OccupancyStepper
                        occupancy={buffer?.occupancy ?? 0}
                        capacity={buffer?.capacity ?? 2}
                        disabled={!canEdit}
                        onCommit={(next) =>
                          buffer && dispatch({ type: "updateBuffer", id: buffer.id, occupancy: next })
                        }
                      />
                    </div>
                  </td>
                  <td>
                    {hits.length === 0 ? (
                      <span className="ok-text">符合</span>
                    ) : (
                      <div className="hit-list">
                        {hits.map((hit) => (
                          <RuleBadge key={hit.rule} code={hit.rule} />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canEdit ? (
        <p className="form-hint">班组长视角为只读：放行请在下方复核队列操作。</p>
      ) : (
        <p className="form-hint">规则阈值：走廊压差 &lt; 5 Pa、实测方向与设计方向倒置、缓冲间在室 = 2 人。</p>
      )}
    </section>
  );
}
