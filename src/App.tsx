import { useState } from "react";
import "./styles.css";
import { useRepoState } from "./ui/useRepoState";
import { ShiftBar } from "./ui/ShiftBar";
import { MetricCards } from "./ui/MetricCards";
import { RoomRegistry } from "./ui/RoomRegistry";
import { ConflictBoard } from "./ui/ConflictBoard";
import { PassageDesk } from "./ui/PassageDesk";
import type { Role } from "./data/types";

export default function App() {
  const state = useRepoState();
  const [role, setRole] = useState<Role>("巡检员");
  const [operator, setOperator] = useState("巡检员-张工");
  const [pickedRoom, setPickedRoom] = useState<string | null>(null);
  const [flashCode, setFlashCode] = useState<string | null>(null);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-09 · port 5109 · 压差梯度通行闭环</p>
          <h1>半导体洁净室巡检</h1>
          <p className="subtitle">
            房间登记走廊压差、相邻房间压差方向与缓冲间人数；低压（&lt;5Pa）、方向倒置或人数到两人时，
            通行申请停在待复核，填写依据并经班组长放行。放行即冻结，补录只生成带原因的新版本，跨班未复核自动顺延。
          </p>
        </div>
        <div className="stack-card">
          <span>分层实现</span>
          <strong>
            数据层（types / repository / localStorage）
            <br />
            判定层（pressureRules / shift 纯函数）
            <br />
            页面层（ui 组件，只做编排与渲染）
          </strong>
        </div>
      </section>

      <MetricCards
        rooms={state.rooms}
        airlocks={state.airlocks}
        applications={state.applications}
      />

      <ShiftBar
        role={role}
        onRoleChange={setRole}
        operator={operator}
        onOperatorChange={setOperator}
        baseDate={state.shiftBaseDate}
        shiftIndex={state.shiftIndex}
      />

      <ConflictBoard
        rooms={state.rooms}
        airlocks={state.airlocks}
        onPickRoom={(refId) => setPickedRoom(refId)}
      />

      <div className="two-col">
        <RoomRegistry
          rooms={state.rooms}
          airlocks={state.airlocks}
          role={role}
          operator={operator}
          pickedRoom={pickedRoom}
          onPickedHandled={() => setPickedRoom(null)}
          onApplied={(code) => {
            setFlashCode(code);
            window.setTimeout(() => setFlashCode(null), 2400);
          }}
        />
        <PassageDesk
          applications={state.applications}
          rooms={state.rooms}
          airlocks={state.airlocks}
          role={role}
          operator={operator}
          baseDate={state.shiftBaseDate}
          shiftIndex={state.shiftIndex}
          flashCode={flashCode}
        />
      </div>

      <footer className="page-foot">
        数据写入 localStorage（hxwl-09.pressure-pass-loop.v1）：刷新后申请、放行版本与顺延状态保持一致。
        数据、判定与页面分离实现，规则变更只需修改判定层。
      </footer>
    </main>
  );
}
