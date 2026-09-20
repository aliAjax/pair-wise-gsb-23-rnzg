// 页面层通用控件：数字输入、人员步进、徽标、状态徽章。
import { useEffect, useState } from "react";
import type { RuleCode } from "../domain/types";
import { RULE_LABELS } from "../domain/rules";

export function NumberField({
  value,
  onCommit,
  suffix,
  min,
  max,
  step = 1,
  disabled,
  ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (text: string) => {
    const next = Number(text);
    if (Number.isFinite(next)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next));
      onCommit(clamped);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <span className="num-field">
      <input
        aria-label={ariaLabel}
        value={draft}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      {suffix ? <em>{suffix}</em> : null}
    </span>
  );
}

export function OccupancyStepper({
  occupancy,
  capacity,
  onCommit,
  disabled,
}: {
  occupancy: number;
  capacity: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className="stepper">
      <button
        type="button"
        onClick={() => onCommit(occupancy - 1)}
        disabled={disabled || occupancy <= 0}
        aria-label="减少人数"
      >
        −
      </button>
      <strong className={occupancy >= capacity ? "count-full" : ""}>{occupancy}</strong>
      <button
        type="button"
        onClick={() => onCommit(occupancy + 1)}
        disabled={disabled || occupancy >= capacity}
        aria-label="增加人数"
      >
        +
      </button>
      <em>/{capacity} 人</em>
    </span>
  );
}

const ruleTone: Record<RuleCode, string> = {
  R1: "tone-r1",
  R2: "tone-r2",
  R3: "tone-r3",
};

export function RuleBadge({ code }: { code: RuleCode }) {
  return (
    <span className={`rule-badge ${ruleTone[code]}`}>
      {code} · {RULE_LABELS[code]}
    </span>
  );
}

export function StatusBadge({ status }: { status: "待复核" | "已放行" }) {
  return <span className={`status-badge status-${status === "已放行" ? "ok" : "hold"}`}>{status}</span>;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
