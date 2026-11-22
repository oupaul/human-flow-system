// 日期工具：一律以「本地（使用者所在時區）」的日曆日期為準。
// 不要用 new Date().toISOString().slice(0, 10)：它是 UTC 日期，在台灣（UTC+8）早上 8 點前會是昨天，
// 對「本地午夜」的 Date（例如 new Date(2026, 9, 1)）更會少一天。
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const todayStr = (): string => toLocalDateStr(new Date());
export const currentMonthStr = (): string => todayStr().slice(0, 7);
