// 判定层：班次工具（A/B/C 三班轮换，跨班顺延用）

export type ShiftKind = "A" | "B" | "C";

export interface ShiftInfo {
  index: number;
  kind: ShiftKind;
  date: string; // YYYY-MM-DD
  label: string; // 2026-09-20 A班
}

const ORDER: ShiftKind[] = ["A", "B", "C"];

/** 以 seed 的基准日期 + 班次序号推导当前班次（每天三班） */
export function shiftInfo(baseDate: string, shiftIndex: number): ShiftInfo {
  const kind = ORDER[((shiftIndex % 3) + 3) % 3];
  const dayOffset = Math.floor(shiftIndex / 3);
  const base = new Date(`${baseDate}T00:00:00`);
  base.setDate(base.getDate() + dayOffset);
  const date = base.toISOString().slice(0, 10);
  return { index: shiftIndex, kind, date, label: `${date} ${kind}班` };
}

export function nextShift(baseDate: string, shiftIndex: number): ShiftInfo {
  return shiftInfo(baseDate, shiftIndex + 1);
}
