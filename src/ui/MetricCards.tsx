// 页面层：领域指标卡

import { evaluateAll } from "../rules/pressureRules";
import type { Airlock, PassageApplication, RoomRegistration } from "../data/types";

interface Metric {
  label: string;
  value: string;
  tone: "ok" | "watch" | "danger";
  hint: string;
}

export function MetricCards({
  rooms,
  airlocks,
  applications,
}: {
  rooms: RoomRegistration[];
  airlocks: Airlock[];
  applications: PassageApplication[];
}) {
  const liveConflicts = evaluateAll(rooms, airlocks);
  const lowPressure = liveConflicts.filter(
    (c) => c.ruleId === "LOW_CORRIDOR_PRESSURE"
  ).length;
  const inverted = liveConflicts.filter(
    (c) => c.ruleId === "DIRECTION_INVERTED"
  ).length;
  const pending = applications.filter((a) => a.status !== "released").length;
  const releasedToday = applications.filter((a) => a.status === "released").length;

  const metrics: Metric[] = [
    {
      label: "走廊压差低于5Pa",
      value: String(lowPressure),
      tone: lowPressure > 0 ? "danger" : "ok",
      hint: "命中房间数（实时判定）",
    },
    {
      label: "压差方向倒置",
      value: String(inverted),
      tone: inverted > 0 ? "danger" : "ok",
      hint: "实测方向 ≠ 梯度要求",
    },
    {
      label: "待复核 / 顺延",
      value: String(pending),
      tone: pending > 0 ? "watch" : "ok",
      hint: "通行申请停在复核环节",
    },
    {
      label: "已放行（冻结）",
      value: String(releasedToday),
      tone: "ok",
      hint: "自动放行 + 班组长复核放行",
    },
  ];

  return (
    <section className="metrics-grid">
      {metrics.map((m) => (
        <article key={m.label} className={`metric-card tone-${m.tone}`}>
          <span>{m.label}</span>
          <strong>{m.value}</strong>
          <p className="metric-hint">{m.hint}</p>
          <i className={`status-dot status-${m.tone}`} />
        </article>
      ))}
    </section>
  );
}
