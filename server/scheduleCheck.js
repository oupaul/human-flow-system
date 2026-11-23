// 排班輔助檢查：直接檢查「排好的班表」（不是事後的打卡紀錄），讓排班時就能看到哪裡不符合規則。
// 這是輔助提醒，不是法律判定；變形工時、勞資會議同意的例外等情況請由人資或勞動顧問確認，
// 目前一律依一般工時的規則檢查。
//
//   daily_hours       單日排班工時（扣除休息時間）超過 12 小時（勞基法第 32 條）                       ［警示］
//   rest_interval     相鄰兩天的班，下班到下一班上班的間隔不足 11 小時（第 34 條，輪班應有連續 11 小時休息）［警示］
//   consecutive_days  連續 7 天（含）以上每天都排上班，中間沒有任何排休                                 ［警示］
//   no_regular_off    任何連續 7 天都有排休，但沒有「例假日」（第 36 條）                               ［警示］
//   no_rest_day       任何連續 7 天有例假日，但沒有「休息日」（國定假日平移的排休也算）（第 36 條）          ［警示］
//   weekly_hours      整週（週一到週日）七天都已排班，且排班工時超過 40 小時，代表會產生加班              ［提示］
//
// 二週變形工時（勞基法第 30 條第 2 項、第 36 條第 2 項）的員工改用下列規則（週期由員工設定的起算日起每 14 天一期）：
//   * 單日排班超過 10 小時（變形後每日正常工時上限）為提示，超過 12 小時仍是警示
//   * 週工時門檻改為 48 小時（提示）；整個週期排班超過 80 小時為提示（cycle_hours）
//   * 不再要求「每七天一個休息日」，改為：每七天至少一日例假，且每二週內例假＋休息日至少 4 日（cycle_days_off，警示）
//   * 國定假日平移的排休與休息日同樣算入
//
// 七天視窗檢查只看「整段七天都已排班」的區間，避免尚未排完時誤報。

import { getScheduleMap, listShiftTypes, normalizeCell, expandFillCells, expandPatternCells, ScheduleError } from './schedule.js';

export const LIMITS = {
  dailyHours: 12, minRestHours: 11, weeklyHours: 40,
  flex2w: { dailyNormalHours: 10, weeklyHours: 48, cycleHours: 80, cycleDays: 14, cycleDaysOff: 4 },
};
export const SEVERITY = {
  daily_hours: 'warning', rest_interval: 'warning', consecutive_days: 'warning',
  no_regular_off: 'warning', no_rest_day: 'warning', weekly_hours: 'info',
  cycle_days_off: 'warning', daily_normal_hours: 'info', cycle_hours: 'info',
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const toMinutes = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m; };
const round1 = (n) => Math.round(n * 10) / 10;

function dayInfo(cell) {
  if (cell.kind === 'off') return { kind: 'off', offType: cell.offType };
  const startMin = toMinutes(cell.startTime);
  let endMin = toMinutes(cell.endTime);
  if (endMin <= startMin) endMin += 24 * 60; // 跨夜班
  return { kind: 'shift', startMin, endMin, hours: (endMin - startMin - (cell.breakMinutes ?? 0)) / 60 };
}

// 把連續（重疊）的視窗合併成一段區間
function mergeRanges(starts) {
  const ranges = [];
  for (const s of starts) {
    const e = addDays(s, 6);
    const last = ranges[ranges.length - 1];
    if (last && s <= addDays(last.end, 1)) last.end = e; else ranges.push({ start: s, end: e });
  }
  return ranges;
}

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

// days：Map<日期, { kind, offType?, startTime?, endTime?, breakMinutes? }>；回傳與 [from, to] 有交集的警示
export function analyzeEmployee(employeeId, days, from, to, profile = null) {
  const flex = profile?.mode === 'flex2w' && DATE_RE.test(String(profile.cycleStart || '')) ? LIMITS.flex2w : null;
  const info = new Map();
  for (const [date, cell] of days) info.set(date, dayInfo(cell));
  const issues = [];
  const push = (type, start, end, params = {}) => issues.push({ employeeId, type, severity: SEVERITY[type], startDate: start, endDate: end, params });

  for (let d = from; d <= to; d = addDays(d, 1)) {
    const x = info.get(d);
    if (x?.kind !== 'shift') continue;
    if (x.hours > LIMITS.dailyHours) push('daily_hours', d, d, { hours: round1(x.hours), limit: LIMITS.dailyHours });
    else if (flex && x.hours > flex.dailyNormalHours) push('daily_normal_hours', d, d, { hours: round1(x.hours), limit: flex.dailyNormalHours });
  }

  for (let d = addDays(from, -1); d <= to; d = addDays(d, 1)) {
    const a = info.get(d);
    const b = info.get(addDays(d, 1));
    if (a?.kind !== 'shift' || b?.kind !== 'shift') continue;
    const gap = 24 * 60 + b.startMin - a.endMin;
    if (gap < LIMITS.minRestHours * 60) push('rest_interval', d, addDays(d, 1), { gapHours: round1(gap / 60) });
  }

  const buckets = { consecutive_days: [], no_regular_off: [], no_rest_day: [] };
  for (let s = addDays(from, -6); s <= to; s = addDays(s, 1)) {
    const window = Array.from({ length: 7 }, (_, i) => info.get(addDays(s, i)));
    if (window.some((x) => !x)) continue;
    const offs = window.filter((x) => x.kind === 'off');
    if (offs.length === 0) buckets.consecutive_days.push(s);
    else if (!offs.some((x) => x.offType === 'regular_off')) buckets.no_regular_off.push(s);
    else if (!flex && !offs.some((x) => x.offType === 'rest_day' || x.offType === 'national_holiday')) buckets.no_rest_day.push(s);
  }
  for (const [type, starts] of Object.entries(buckets)) {
    for (const r of mergeRanges(starts)) push(type, r.start, r.end, { days: daysBetween(r.start, r.end) });
  }

  const weekday = new Date(`${from}T00:00:00Z`).getUTCDay(); // 0=日
  for (let ws = addDays(from, -((weekday + 6) % 7)); ws <= to; ws = addDays(ws, 7)) {
    const week = Array.from({ length: 7 }, (_, i) => info.get(addDays(ws, i)));
    if (week.some((x) => !x)) continue;
    const hours = week.reduce((sum, x) => sum + (x.kind === 'shift' ? x.hours : 0), 0);
    const limit = flex ? flex.weeklyHours : LIMITS.weeklyHours;
    if (hours > limit) push('weekly_hours', ws, addDays(ws, 6), { hours: round1(hours), limit });
  }

  // 二週變形：以起算日為準的固定 14 天週期（不是滾動視窗）
  if (flex) {
    const offset = Math.floor((Date.parse(`${from}T00:00:00Z`) - Date.parse(`${profile.cycleStart}T00:00:00Z`)) / 86400000 / flex.cycleDays);
    for (let cs = addDays(profile.cycleStart, offset * flex.cycleDays); cs <= to; cs = addDays(cs, flex.cycleDays)) {
      const cycle = Array.from({ length: flex.cycleDays }, (_, i) => info.get(addDays(cs, i)));
      if (cycle.some((x) => !x)) continue;
      const end = addDays(cs, flex.cycleDays - 1);
      const daysOff = cycle.filter((x) => x.kind === 'off').length;
      if (daysOff < flex.cycleDaysOff) push('cycle_days_off', cs, end, { count: daysOff, required: flex.cycleDaysOff });
      const total = cycle.reduce((sum, x) => sum + (x.kind === 'shift' ? x.hours : 0), 0);
      if (total > flex.cycleHours) push('cycle_hours', cs, end, { hours: round1(total), limit: flex.cycleHours });
    }
  }

  return issues.filter((i) => i.endDate >= from && i.startDate <= to)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.type.localeCompare(b.type));
}

function monthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new ScheduleError(400, '月份格式不正確（需 YYYY-MM）');
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

// 員工的工時制度：Map<employeeId, { mode, cycleStart }>
async function loadProfiles(pool, employeeIds) {
  if (employeeIds.length === 0) return new Map();
  const [rows] = await pool.query('SELECT employeeId, workTimeMode, workTimeCycleStart FROM employees WHERE employeeId IN (?)', [employeeIds]);
  return new Map(rows.map((r) => [r.employeeId, { mode: r.workTimeMode, cycleStart: r.workTimeCycleStart }]));
}

// 整個月、一群員工的排班警示
export async function checkMonth(pool, month, employeeIds) {
  const { from, to } = monthBounds(month);
  if (employeeIds.length === 0) return [];
  const map = await getScheduleMap(pool, employeeIds, addDays(from, -15), addDays(to, 15));
  const profiles = await loadProfiles(pool, employeeIds);
  const issues = [];
  for (const [employeeId, days] of map) issues.push(...analyzeEmployee(employeeId, days, from, to, profiles.get(employeeId)));
  return issues;
}

const overlaps = (a, b) => a.employeeId === b.employeeId && a.type === b.type && a.startDate <= b.endDate && b.startDate <= a.endDate;
const MAX_LISTED = 50;

// 預覽：假設做了這些變更，會「新增」哪些警示、「解除」哪些警示、哪些「仍然存在」（不會寫入資料庫）
// scenarios：[{ key, cells } 或 { key, fill }]
export async function previewScenarios(pool, scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length === 0 || scenarios.length > 30) throw new ScheduleError(400, '預覽的情境數量不正確');
  const prepared = [];
  for (const sc of scenarios) {
    const raw = sc.cells ?? (sc.pattern ? await expandPatternCells(pool, sc.pattern) : expandFillCells(sc.fill || {}));
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20000) throw new ScheduleError(400, '預覽的儲存格數量不正確');
    prepared.push({ key: String(sc.key), cells: raw.map(normalizeCell) });
  }
  const all = prepared.flatMap((p) => p.cells);
  const employeeIds = [...new Set(all.map((c) => c.employeeId))];
  const dates = all.map((c) => c.date).sort();
  const base = await getScheduleMap(pool, employeeIds, addDays(dates[0], -15), addDays(dates[dates.length - 1], 15));
  const shiftTypes = new Map((await listShiftTypes(pool)).map((t) => [t.id, t]));
  const profiles = await loadProfiles(pool, employeeIds);

  const results = {};
  for (const { key, cells } of prepared) {
    const cellDates = cells.map((c) => c.date).sort();
    const from = cellDates[0];
    const to = cellDates[cellDates.length - 1];
    const affected = [...new Set(cells.map((c) => c.employeeId))];

    const after = new Map(affected.map((id) => [id, new Map(base.get(id) ?? [])]));
    for (const c of cells) {
      const days = after.get(c.employeeId);
      if (c.clear) days.delete(c.date);
      else if (c.kind === 'off') days.set(c.date, { kind: 'off', offType: c.offType });
      else {
        const t = shiftTypes.get(c.shiftTypeId);
        if (!t) throw new ScheduleError(400, '找不到班別');
        days.set(c.date, { kind: 'shift', startTime: t.startTime, endTime: t.endTime, breakMinutes: t.breakMinutes });
      }
    }

    const beforeIssues = affected.flatMap((id) => analyzeEmployee(id, base.get(id) ?? new Map(), from, to, profiles.get(id)));
    const afterIssues = affected.flatMap((id) => analyzeEmployee(id, after.get(id), from, to, profiles.get(id)));
    const newIssues = afterIssues.filter((a) => !beforeIssues.some((b) => overlaps(a, b)));
    const resolvedIssues = beforeIssues.filter((b) => !afterIssues.some((a) => overlaps(a, b)));
    // 格子層級的統計：新增（原本沒排）、修改（內容不同）、不變
    const stats = { added: 0, changed: 0, unchanged: 0 };
    for (const c of cells) {
      const cur = base.get(c.employeeId)?.get(c.date);
      if (c.clear) { if (cur) stats.changed += 1; else stats.unchanged += 1; }
      else if (!cur) stats.added += 1;
      else if (c.kind === 'shift' ? cur.kind === 'shift' && cur.shiftTypeId === c.shiftTypeId : cur.kind === 'off' && cur.offType === c.offType) stats.unchanged += 1;
      else stats.changed += 1;
    }
    results[key] = {
      stats,
      newCount: newIssues.length,
      resolvedCount: resolvedIssues.length,
      newIssues: newIssues.slice(0, MAX_LISTED),
      resolvedIssues: resolvedIssues.slice(0, MAX_LISTED),
      // 原本就有、套用後仍然存在的警示（單格預覽用：選了這個選項，那一天還是有問題）
      remainingIssues: afterIssues.filter((a) => beforeIssues.some((b) => overlaps(a, b))).slice(0, MAX_LISTED),
    };
  }
  return results;
}
