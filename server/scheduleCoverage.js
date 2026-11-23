// 依每班需求人數自動排班：給定每個班別「週一到週日各需幾人」，從選取的員工中自動分配，
// 同時盡量遵守：每個週一～週日最多上 5 天（至少 2 天休息：1 例假日＋1 休息日）、不連續上班超過 6 天、
// 相鄰兩班間隔至少 11 小時、各人上班天數盡量平均。結果只是草稿（預覽後才寫入），人工可再逐格調整。
//
// 這是啟發式的貪婪演算法，不保證最佳；需求人數超過可用人力時會回報「缺人」的日期與班別，不會硬排。
import { getScheduleMap, listShiftTypes, ScheduleError } from './schedule.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const mondayIndex = (ymd) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7; // 週一＝0
const toMin = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m; };
export const MAX_WEEK_WORK_DAYS = 5;
export const MAX_CONSECUTIVE = 6;
const MAX_LISTED = 60;

function shiftSpan(t) {
  const start = toMin(t.startTime);
  let end = toMin(t.endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}
// 前一天做 prev 班、今天做 next 班時，下班到上班的間隔（分鐘）
// 依序比較兩組分數（越小越優先）
const lessThan = (a, b) => { for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
const restGap = (prev, next) => 24 * 60 + shiftSpan(next).start - shiftSpan(prev).end;

export async function planCoverage(pool, p) {
  const { employeeIds, from, to } = p || {};
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) throw new ScheduleError(400, '請選擇員工');
  if (employeeIds.length > 200) throw new ScheduleError(400, '自動排班一次最多 200 位員工');
  if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to)) || from > to) throw new ScheduleError(400, '日期區間不正確');
  if (dayDiff(from, to) > 92) throw new ScheduleError(400, '一次最多排 93 天');
  if (!Array.isArray(p.demand) || p.demand.length === 0) throw new ScheduleError(400, '請設定每班需求人數');

  const shiftTypes = new Map((await listShiftTypes(pool)).map((t) => [t.id, t]));
  const demand = p.demand.map((d) => {
    const t = shiftTypes.get(Number(d.shiftTypeId));
    if (!t || !t.active) throw new ScheduleError(400, '需求裡有不存在或已停用的班別');
    const counts = Array.isArray(d.counts) && d.counts.length === 7 ? d.counts.map((n) => Math.max(0, Math.min(200, Math.floor(Number(n) || 0)))) : null;
    if (!counts) throw new ScheduleError(400, '每個班別需要提供週一到週日的需求人數');
    return { shiftTypeId: t.id, counts, type: t };
  });
  if (demand.every((d) => d.counts.every((n) => n === 0))) throw new ScheduleError(400, '需求人數全部是 0，沒有要排的班');
  const holidayOff = p.holidayMode === 'off';
  const skipExisting = p.skipExisting !== false;

  let holidays = new Set();
  if (holidayOff) {
    const [rows] = await pool.query('SELECT date FROM holidays WHERE isHoliday = TRUE AND CHAR_LENGTH(name) > 0 AND date BETWEEN ? AND ?', [from, to]);
    holidays = new Set(rows.map((r) => String(r.date).slice(0, 10)));
  }

  const existing = await getScheduleMap(pool, employeeIds, addDays(from, -7), to);
  const exAt = (id, d) => existing.get(id)?.get(d);

  // 起始狀態：區間前一天為止的連續上班天數、前一天的班別
  const state = new Map();
  for (const id of employeeIds) {
    let consec = 0;
    for (let d = addDays(from, -1); consec < 7 && exAt(id, d)?.kind === 'shift'; d = addDays(d, -1)) consec += 1;
    const prev = exAt(id, addDays(from, -1));
    state.set(id, { consec, prevShiftId: prev?.kind === 'shift' ? prev.shiftTypeId : null, weekWorked: 0, total: 0, weekend: 0, perShift: new Map(), workedYesterday: consec > 0 });
  }

  const cells = []; // { employeeId, date, kind, shiftTypeId, offType }
  const freeOffs = new Map(employeeIds.map((id) => [id, []])); // 待標記例假／休息日的休息日期
  const shortages = [];
  let shortageTotal = 0;

  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = mondayIndex(d);
    if (wd === 0 || d === from) {
      // 新的一週（或區間第一天）：把這週前面已經上班的天數算進去
      const weekStart = addDays(d, -wd);
      for (const id of employeeIds) {
        let worked = 0;
        for (let x = weekStart; x < d; x = addDays(x, 1)) if (exAt(id, x)?.kind === 'shift') worked += 1;
        state.get(id).weekWorked = worked;
      }
    }

    const fixed = new Map(); // employeeId → 既有格子
    if (skipExisting) for (const id of employeeIds) { const c = exAt(id, d); if (c) fixed.set(id, c); }

    const need = new Map(demand.map((x) => [x.shiftTypeId, holidays.has(d) ? 0 : x.counts[wd]]));
    const dayWorkers = new Map(); // employeeId → shiftTypeId（今天上班者，含既有）
    for (const [id, c] of fixed) if (c.kind === 'shift') {
      dayWorkers.set(id, c.shiftTypeId);
      if (need.has(c.shiftTypeId)) need.set(c.shiftTypeId, Math.max(0, need.get(c.shiftTypeId) - 1));
    }

    const free = employeeIds.filter((id) => !fixed.has(id));
    if (holidays.has(d)) {
      for (const id of free) cells.push({ employeeId: id, date: d, kind: 'off', shiftTypeId: null, offType: 'national_holiday' });
      free.length = 0;
    }

    // 誰上班：只考慮還沒上滿 5 天、連續未達 6 天的人；昨天有上班的優先（讓同一批人連續上班，不要隔天輪流），其次總上班天數少的
    const eligible = free.filter((id) => { const s = state.get(id); return s.weekWorked < MAX_WEEK_WORK_DAYS && s.consec < MAX_CONSECUTIVE; });
    // 上班天數已明顯多於別人（超過 3 天）的人往後排，避免「昨天有上班優先」讓少數人一直上班
    const minTotal = eligible.length ? Math.min(...eligible.map((id) => state.get(id).total)) : 0;
    eligible.sort((a, b) => {
      const sa = state.get(a); const sb = state.get(b);
      const ahead = (x) => (x.total - minTotal >= 3 ? 1 : 0);
      return (ahead(sa) - ahead(sb)) || (sb.workedYesterday - sa.workedYesterday) || (sa.total - sb.total) || (employeeIds.indexOf(a) - employeeIds.indexOf(b));
    });
    const totalNeed = [...need.values()].reduce((s, n) => s + n, 0);
    const picked = eligible.slice(0, totalNeed);

    // 指派班別：需求大的班別先排；優先沿用昨天同一班、符合 11 小時間隔、且該班累計次數較少者
    const unassigned = new Set(picked);
    const order = [...need.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const assignedCount = new Map();
    for (const [shiftId, n] of order) {
      const t = shiftTypes.get(shiftId);
      for (let k = 0; k < n && unassigned.size > 0; k += 1) {
        let best = null; let bestScore = null;
        for (const id of unassigned) {
          const s = state.get(id);
          const gapOk = s.prevShiftId == null || !s.workedYesterday || restGap(shiftTypes.get(s.prevShiftId), t) >= 11 * 60;
          const score = [gapOk ? 0 : 1, s.prevShiftId === shiftId && s.workedYesterday ? 0 : 1, s.perShift.get(shiftId) ?? 0, employeeIds.indexOf(id)];
          if (!bestScore || lessThan(score, bestScore)) { best = id; bestScore = score; }
        }
        dayWorkers.set(best, shiftId);
        unassigned.delete(best);
        assignedCount.set(shiftId, (assignedCount.get(shiftId) ?? 0) + 1);
        cells.push({ employeeId: best, date: d, kind: 'shift', shiftTypeId: shiftId, offType: null });
      }
      const missing = n - (assignedCount.get(shiftId) ?? 0);
      if (missing > 0) {
        shortageTotal += 1;
        if (shortages.length < MAX_LISTED) shortages.push({ date: d, shiftTypeId: shiftId, required: demand.find((x) => x.shiftTypeId === shiftId).counts[wd], missing });
      }
    }

    // 沒被選上的自由員工今天休息（例假／休息日待週末再標記）
    for (const id of free) if (!dayWorkers.has(id)) freeOffs.get(id).push(d);

    // 更新狀態
    for (const id of employeeIds) {
      const s = state.get(id);
      const shiftId = dayWorkers.get(id);
      if (shiftId != null) {
        s.consec += 1; s.weekWorked += 1; s.total += 1; s.prevShiftId = shiftId; s.workedYesterday = true;
        if (wd >= 5) s.weekend += 1;
        s.perShift.set(shiftId, (s.perShift.get(shiftId) ?? 0) + 1);
      } else {
        s.consec = 0; s.workedYesterday = false;
      }
    }
  }

  // 標記休息類別：每個週一～週日內，沒有例假日的人把其中一個休息日（優先星期日，否則最後一個）標成例假日，其餘為休息日
  const offCells = [];
  for (const id of employeeIds) {
    const byWeek = new Map();
    for (const d of freeOffs.get(id)) {
      const weekStart = addDays(d, -mondayIndex(d));
      byWeek.set(weekStart, [...(byWeek.get(weekStart) ?? []), d]);
    }
    // 上一個例假日：區間前最近一筆既有的，之後依序更新；用來讓相鄰兩次例假盡量相隔 7 天
    let prevRegular = null;
    for (let x = addDays(from, -1); x >= addDays(from, -7); x = addDays(x, -1)) if (exAt(id, x)?.kind === 'off' && exAt(id, x).offType === 'regular_off') { prevRegular = x; break; }
    for (const weekStart of [...byWeek.keys()].sort()) {
      const days = byWeek.get(weekStart);
      let hasRegular = false;
      for (let x = weekStart; x <= addDays(weekStart, 6); x = addDays(x, 1)) {
        const c = skipExisting ? exAt(id, x) : null;
        if (c?.kind === 'off' && c.offType === 'regular_off') { hasRegular = true; prevRegular = x; }
      }
      let regularDay = null;
      if (!hasRegular) {
        regularDay = prevRegular
          ? [...days].sort((a, b) => Math.abs(dayDiff(prevRegular, a) - 7) - Math.abs(dayDiff(prevRegular, b) - 7))[0]
          : (days.includes(addDays(weekStart, 6)) ? addDays(weekStart, 6) : days[days.length - 1]);
        prevRegular = regularDay;
      }
      for (const d of days) offCells.push({ employeeId: id, date: d, kind: 'off', shiftTypeId: null, offType: d === regularDay ? 'regular_off' : 'rest_day' });
    }
  }
  const all = [...cells, ...offCells].sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));
  if (all.length === 0) throw new ScheduleError(400, '沒有任何要填入的格子（可能全部已排好）');

  const summary = employeeIds.map((id) => {
    const s = state.get(id);
    return { employeeId: id, workDays: s.total, weekendDays: s.weekend, shifts: Object.fromEntries(s.perShift) };
  });
  return { cells: all, report: { shortageTotal, shortages, summary } };
}

export async function expandCoverageCells(pool, p) {
  return (await planCoverage(pool, p)).cells;
}
