// 值班輪替排班：模擬公司「值班班表」的做法。
//   * 週六、週日、平日的國定假日都是「需值班日」：每天只有 1 人值班（值班班別），其他人休息
//     （週六＝休息日、週日＝例假日、平日國定假日＝國定假日）；國定假日落在週六日時，依週六／週日處理。
//   * 值班者依輪值名單順序輪流，跨月接續（預設從資料庫裡上一位值班者的下一位開始）；
//     輪到的人若當天已請假或班表已有安排，就跳過，下一次值班日優先輪到他。
//   * 值班後要補假：週日值班補「例假日」（同一週的平日）、週六值班補「休息日」（同週平日，不然下週）、
//     平日國定假日值班補「國定假日」（同月平日）。補假日自動挑「當天上班人數仍高於最低人數、
//     不造成連續上班超過 6 天」的平日，並盡量讓補假分散在不同天。
//   * 平日最低上班人數＝輪值人數 × 比例（無條件進位）。
// 只是排班輔助草稿（預覽後才寫入）；補不到假、人數低於下限會列在報告裡，不會硬排。
import { getScheduleMap, listShiftTypes, ScheduleError } from './schedule.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const mondayIndex = (ymd) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7; // 週一＝0 … 週日＝6
export const MAX_CONSECUTIVE = 6;
const MAX_LISTED = 60;
const COMP_OFF = { sat: 'rest_day', sun: 'regular_off', holiday: 'national_holiday' };

export async function planDuty(pool, p) {
  const { employeeIds, from, to } = p || {};
  if (!Array.isArray(employeeIds) || employeeIds.length < 2) throw new ScheduleError(400, '請選擇至少 2 位輪值人員');
  if (new Set(employeeIds).size !== employeeIds.length) throw new ScheduleError(400, '輪值名單有重複的員工');
  if (employeeIds.length > 60) throw new ScheduleError(400, '輪值人員最多 60 位');
  if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to)) || from > to) throw new ScheduleError(400, '日期區間不正確');
  if (dayDiff(from, to) > 92) throw new ScheduleError(400, '一次最多排 93 天');

  const shiftTypes = new Map((await listShiftTypes(pool)).map((t) => [t.id, t]));
  const dutyShiftId = Number(p.dutyShiftTypeId);
  const dutyShift = shiftTypes.get(dutyShiftId);
  if (!dutyShift || !dutyShift.active) throw new ScheduleError(400, '請選擇值班班別（不存在或已停用）');
  let workShiftId = null;
  if (p.workShiftTypeId != null && p.workShiftTypeId !== '') {
    workShiftId = Number(p.workShiftTypeId);
    const t = shiftTypes.get(workShiftId);
    if (!t || !t.active) throw new ScheduleError(400, '平日班別不存在或已停用');
  }
  const ratio = p.minWorkRatio == null || p.minWorkRatio === '' ? 50 : Number(p.minWorkRatio);
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) throw new ScheduleError(400, '平日最低上班比例需介於 0 到 100');
  const minWork = Math.ceil((employeeIds.length * ratio) / 100 - 1e-9);
  const skipExisting = p.skipExisting !== false;
  const roster = new Set(employeeIds);

  // 國定假日：只取有名稱的節日（行事曆裡週六日也標成假日，但沒有名稱）
  const winFrom = addDays(from, -14);
  const winTo = addDays(to, 14);
  const [holRows] = await pool.query('SELECT date FROM holidays WHERE isHoliday = TRUE AND CHAR_LENGTH(name) > 0 AND date BETWEEN ? AND ?', [winFrom, winTo]);
  const holidays = new Set(holRows.map((r) => String(r.date).slice(0, 10)));
  const isWeekday = (d) => mondayIndex(d) < 5 && !holidays.has(d);

  const existing = await getScheduleMap(pool, employeeIds, winFrom, winTo);
  const exAt = (id, d) => existing.get(id)?.get(d);

  // 已核准請假（那天不能值班、也不能當補假日）
  const leave = new Map(employeeIds.map((id) => [id, new Set()]));
  const [leaveRows] = await pool.query(
    "SELECT employeeId, startDate, endDate FROM leave_applications WHERE status = 'approved' AND employeeId IN (?) AND startDate <= ? AND endDate >= ?",
    [employeeIds, winTo, winFrom]
  );
  for (const r of leaveRows) {
    const s = String(r.startDate).slice(0, 10); const e = String(r.endDate).slice(0, 10);
    for (let d = s < winFrom ? winFrom : s; d <= e && d <= winTo; d = addDays(d, 1)) leave.get(r.employeeId).add(d);
  }

  // 輪值順序：指定起始人員，或從上一位值班者的下一位接續
  let queue = [...employeeIds];
  let startedFrom = null;
  const rotateAfter = (id) => { const i = queue.indexOf(id); queue = [...queue.slice(i + 1), ...queue.slice(0, i + 1)]; };
  if (p.startEmployeeId && roster.has(p.startEmployeeId)) {
    const i = queue.indexOf(p.startEmployeeId);
    queue = [...queue.slice(i), ...queue.slice(0, i)];
    startedFrom = 'manual';
  } else {
    const [last] = await pool.query('SELECT employeeId FROM work_schedules WHERE shiftTypeId = ? AND employeeId IN (?) AND date < ? ORDER BY date DESC, id DESC LIMIT 1', [dutyShiftId, employeeIds, from]);
    if (last[0]) { rotateAfter(last[0].employeeId); startedFrom = 'auto'; }
  }
  const firstInQueue = queue[0];

  // 規劃中的格子：key = id|date → cell
  const plan = new Map();
  const put = (id, date, cell) => plan.set(`${id}|${date}`, { employeeId: id, date, ...cell });
  const planned = (id, d) => plan.get(`${id}|${d}`);
  // 某人某天的狀態：work／off／none（沒資料：平日視為上班，週末視為休息）
  const statusOf = (id, d) => {
    const c = planned(id, d) ?? exAt(id, d);
    if (c) return c.kind === 'shift' ? 'work' : 'off';
    if (leave.get(id).has(d)) return 'off';
    return isWeekday(d) ? 'work' : 'off';
  };

  // ---- 1. 排每個需值班日的值班者 ----
  const duties = []; // { date, type, employeeId }
  const dutyShortages = [];
  const skipped = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = mondayIndex(d);
    const type = wd === 5 ? 'sat' : wd === 6 ? 'sun' : holidays.has(d) ? 'holiday' : null;
    if (!type) continue;

    // 當天已經排好值班班別的人（不覆蓋）
    let dutyId = skipExisting ? employeeIds.find((id) => exAt(id, d)?.kind === 'shift' && exAt(id, d).shiftTypeId === dutyShiftId) : null;
    if (dutyId) rotateAfter(dutyId);
    else {
      let pick = -1;
      const blocked = [];
      for (let i = 0; i < queue.length; i += 1) {
        const id = queue[i];
        if (leave.get(id).has(d)) { blocked.push({ employeeId: id, reason: 'leave' }); continue; }
        if (skipExisting && exAt(id, d)) { blocked.push({ employeeId: id, reason: 'existing' }); continue; }
        pick = i; break;
      }
      if (pick < 0) { dutyShortages.push({ date: d, type }); }
      else {
        dutyId = queue[pick];
        queue = [...queue.slice(0, pick), ...queue.slice(pick + 1), dutyId]; // 被跳過的留在最前面，下次優先
        for (const b of blocked.slice(0, pick)) if (skipped.length < MAX_LISTED) skipped.push({ date: d, ...b });
        put(dutyId, d, { kind: 'shift', shiftTypeId: dutyShiftId, offType: null });
      }
    }
    // 其他人當天休息
    for (const id of employeeIds) {
      if (id === dutyId) continue;
      if (skipExisting && exAt(id, d)) continue;
      put(id, d, { kind: 'off', shiftTypeId: null, offType: COMP_OFF[type] });
    }
    if (dutyId) duties.push({ date: d, type, employeeId: dutyId });
  }

  // ---- 2. 值班後補假 ----
  const weekdaysOf = (weekStart) => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)).filter(isWeekday);
  const windowFor = (date, type) => {
    const weekStart = addDays(date, -mondayIndex(date));
    if (type === 'sun') return [weekdaysOf(weekStart)];
    if (type === 'sat') return [weekdaysOf(weekStart), weekdaysOf(addDays(weekStart, 7))];
    const ym = date.slice(0, 7);
    const days = [];
    for (let x = addDays(date, -31); x <= addDays(date, 31); x = addDays(x, 1)) if (x.startsWith(ym) && isWeekday(x)) days.push(x);
    return [days.sort((a, b) => Math.abs(dayDiff(date, a)) - Math.abs(dayDiff(date, b)))];
  };
  const workingCount = (d) => employeeIds.filter((id) => statusOf(id, d) === 'work').length;
  // 把某天改成休息後，那個人附近的最長連續上班天數
  const maxRunIfOff = (id, off) => {
    let best = 0; let run = 0;
    for (let x = addDays(off, -9); x <= addDays(off, 9); x = addDays(x, 1)) {
      if (x !== off && statusOf(id, x) === 'work') { run += 1; if (run > best) best = run; } else run = 0;
    }
    return best;
  };
  const claimed = new Set(); // 已被拿來抵補假的既有排休
  const missingComp = [];
  let compOutside = 0;
  for (const duty of duties) {
    const needType = COMP_OFF[duty.type];
    const windows = windowFor(duty.date, duty.type);
    const id = duty.employeeId;
    // 視窗內已經有對應類別的排休（含之前就排好的）就算已補
    const already = windows.flat().find((x) => !claimed.has(`${id}|${x}`) && (planned(id, x)?.kind ?? exAt(id, x)?.kind) === 'off' && (planned(id, x)?.offType ?? exAt(id, x)?.offType) === needType);
    if (already) { claimed.add(`${id}|${already}`); continue; }

    let chosen = null;
    for (const days of windows) {
      const cands = days.filter((x) => !leave.get(id).has(x) && !claimed.has(`${id}|${x}`) && !planned(id, x) && !(skipExisting && exAt(id, x)));
      if (cands.length === 0) continue;
      const scored = cands.map((x) => {
        const after = workingCount(x) - 1;
        const run = maxRunIfOff(id, x);
        return { x, after, run, score: [run > MAX_CONSECUTIVE ? 1 : 0, after < minWork ? 1 : 0, x < from || x > to ? 1 : 0, -after, run, Math.abs(dayDiff(duty.date, x)), x] };
      });
      scored.sort((a, b) => { for (let i = 0; i < a.score.length; i += 1) if (a.score[i] !== b.score[i]) return a.score[i] < b.score[i] ? -1 : 1; return 0; });
      // 第一個視窗有「完全合規」的就用；否則看下個視窗，最後才勉強用最佳者
      if (scored[0].score[0] === 0 && scored[0].score[1] === 0) { chosen = scored[0]; break; }
      if (!chosen || (chosen.score[0] + chosen.score[1] > scored[0].score[0] + scored[0].score[1])) chosen = scored[0];
    }
    if (!chosen) { if (missingComp.length < MAX_LISTED) missingComp.push({ employeeId: id, date: duty.date, offType: needType }); continue; }
    put(id, chosen.x, { kind: 'off', shiftTypeId: null, offType: needType });
    claimed.add(`${id}|${chosen.x}`);
    if (chosen.x < from || chosen.x > to) compOutside += 1;
  }

  // ---- 3. 平日填入上班班別（選填）----
  if (workShiftId != null) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!isWeekday(d)) continue;
      for (const id of employeeIds) {
        if (planned(id, d) || leave.get(id).has(d)) continue;
        if (skipExisting && exAt(id, d)) continue;
        put(id, d, { kind: 'shift', shiftTypeId: workShiftId, offType: null });
      }
    }
  }

  // ---- 4. 報告 ----
  const lowHeadcount = [];
  let lowTotal = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isWeekday(d)) continue;
    const n = workingCount(d);
    if (n < minWork) { lowTotal += 1; if (lowHeadcount.length < MAX_LISTED) lowHeadcount.push({ date: d, working: n, required: minWork }); }
  }
  const dutyCount = new Map(employeeIds.map((id) => [id, 0]));
  for (const d of duties) dutyCount.set(d.employeeId, dutyCount.get(d.employeeId) + 1);
  const missingBy = new Map();
  for (const m of missingComp) missingBy.set(m.employeeId, (missingBy.get(m.employeeId) ?? 0) + 1);
  const cells = [...plan.values()]
    .filter((c) => {
      const cur = exAt(c.employeeId, c.date);
      if (!cur) return true;
      return c.kind === 'shift' ? !(cur.kind === 'shift' && cur.shiftTypeId === c.shiftTypeId) : !(cur.kind === 'off' && cur.offType === c.offType);
    })
    .map(({ employeeId, date, kind, shiftTypeId, offType }) => ({ employeeId, date, kind, shiftTypeId, offType }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));

  const report = {
    minWork,
    dutyTotal: duties.length,
    duties: duties.slice(0, 100),
    dutyShortages: dutyShortages.slice(0, MAX_LISTED),
    dutyShortageTotal: dutyShortages.length,
    skipped,
    missingComp,
    missingCompTotal: missingComp.length,
    lowHeadcount,
    lowHeadcountTotal: lowTotal,
    compOutsideRange: compOutside,
    startedFrom,
    firstEmployeeId: firstInQueue,
    nextEmployeeId: queue[0],
    summary: employeeIds.map((id) => ({ employeeId: id, duties: dutyCount.get(id), missingComp: missingBy.get(id) ?? 0 })),
  };
  return { cells, report };
}

export async function expandDutyCells(pool, p) {
  const { cells } = await planDuty(pool, p);
  if (cells.length === 0) throw new ScheduleError(400, '沒有任何要填入的格子（可能全部已排好）');
  return cells;
}
