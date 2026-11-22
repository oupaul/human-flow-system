// 工時與排班合規「警示」（輔助檢查，不是法律判定；是否合法最終由公司人資或勞動顧問確認）：
//   daily_hours        單日工時（扣除休息時間）超過 12 小時（勞基法第 32 條：延長後每日不得超過 12 小時）
//   consecutive_days   連續上班 7 天以上（勞基法第 36 條：每七日應有一日例假）
//   no_regular_off     班表中任何連續 7 天都沒有「例假日」（只檢查整段七天都已排班的區間，避免漏排造成誤報）
//   monthly_overtime   當月已核准的加班時數超過 46 小時（勞基法第 32 條：每月延長工時不得超過 46 小時）
// 工時是用打卡的上下班時間算：下班時間比上班時間早表示跨夜班，自動加 24 小時。

import { getAttendanceSettings } from './punch.js';

const DAILY_LIMIT_HOURS = 12;
const MONTHLY_OVERTIME_LIMIT = 46;
const CONSECUTIVE_LIMIT = 7;

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const toMinutes = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m; };

export async function getCompliance(pool, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new Error('月份格式不正確（需 YYYY-MM）');
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const settings = await getAttendanceSettings(pool);

  const [records] = await pool.execute(
    `SELECT a.employeeId, a.date, a.clockIn, a.clockOut, a.status, a.shiftStart, t.breakMinutes
     FROM attendance_records a
     LEFT JOIN work_schedules s ON s.employeeId = a.employeeId AND s.date = a.date AND s.kind = 'shift'
     LEFT JOIN shift_types t ON t.id = s.shiftTypeId
     WHERE a.date BETWEEN ? AND ? ORDER BY a.employeeId, a.date`, [from, to]
  );
  const [schedules] = await pool.execute(
    `SELECT employeeId, date, kind, offType FROM work_schedules WHERE date BETWEEN ? AND ? ORDER BY employeeId, date`, [addDays(from, -6), to]
  );
  const [overtime] = await pool.execute(
    `SELECT employeeId, SUM(hours) AS hours FROM overtime_applications WHERE status = 'approved' AND date BETWEEN ? AND ? GROUP BY employeeId`, [from, to]
  );

  const issues = new Map(); // employeeId → [{ type, detail }]
  const add = (employeeId, type, detail) => {
    if (!issues.has(employeeId)) issues.set(employeeId, []);
    issues.get(employeeId).push({ type, detail });
  };

  // 單日工時與連續上班
  const byEmployee = new Map();
  for (const r of records) {
    if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, []);
    byEmployee.get(r.employeeId).push(r);
  }
  for (const [employeeId, rows] of byEmployee) {
    for (const r of rows) {
      if (!r.clockIn || !r.clockOut) continue;
      let span = toMinutes(r.clockOut) - toMinutes(r.clockIn);
      if (span < 0) span += 24 * 60;
      const hours = (span - (r.breakMinutes ?? settings.defaultBreakMinutes)) / 60;
      if (hours > DAILY_LIMIT_HOURS) add(employeeId, 'daily_hours', `${r.date} 工時約 ${hours.toFixed(1)} 小時`);
    }
    let runStart = null;
    let runLength = 0;
    let previous = null;
    const flush = () => {
      if (runLength >= CONSECUTIVE_LIMIT) add(employeeId, 'consecutive_days', `${runStart} ~ ${previous} 連續上班 ${runLength} 天`);
    };
    for (const r of rows.filter((x) => x.clockIn)) {
      if (previous && addDays(previous, 1) === r.date) runLength += 1;
      else { flush(); runStart = r.date; runLength = 1; }
      previous = r.date;
    }
    flush();
  }

  // 班表：七日內沒有例假（只看整段七天都有排班的區間）
  const schedByEmployee = new Map();
  for (const s of schedules) {
    if (!schedByEmployee.has(s.employeeId)) schedByEmployee.set(s.employeeId, new Map());
    schedByEmployee.get(s.employeeId).set(s.date, s);
  }
  for (const [employeeId, days] of schedByEmployee) {
    for (let start = addDays(from, -6); start <= addDays(to, -6); start = addDays(start, 1)) {
      const window = Array.from({ length: 7 }, (_, i) => days.get(addDays(start, i)));
      if (window.some((d) => !d)) continue;
      if (!window.some((d) => d.kind === 'off' && d.offType === 'regular_off')) {
        add(employeeId, 'no_regular_off', `${start} ~ ${addDays(start, 6)} 七天內沒有排例假日`);
        break; // 同一位員工一個月只列第一個區間，避免整月重複
      }
    }
  }

  for (const o of overtime) {
    if (Number(o.hours) > MONTHLY_OVERTIME_LIMIT) add(o.employeeId, 'monthly_overtime', `當月已核准加班 ${Number(o.hours)} 小時（上限 ${MONTHLY_OVERTIME_LIMIT}）`);
  }

  if (issues.size === 0) return [];
  const [employees] = await pool.query('SELECT employeeId, name, department FROM employees WHERE employeeId IN (?)', [[...issues.keys()]]);
  const info = new Map(employees.map((e) => [e.employeeId, e]));
  return [...issues.entries()].map(([employeeId, list]) => ({
    employeeId, name: info.get(employeeId)?.name ?? null, department: info.get(employeeId)?.department ?? null, issues: list,
  })).sort((a, b) => a.employeeId.localeCompare(b.employeeId));
}
