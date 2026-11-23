// 班別與月份班表。班表是「打卡的遲到／早退判斷」與「排班制薪資的日別判斷」的資料來源之一：
//   * 有班表的日子：依班表（上班＝該班別的上下班時間；排休＝休息日／例假日／國定假日）
//   * 沒有班表的日子：固定制依預設班別與行事曆；排班制則改看外部匯入的考勤（備援）
// 班表草稿（尚未發布）也會被打卡與薪資使用，「發布」只決定員工看不看得到。

export class ScheduleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const OFF_TYPES = ['rest_day', 'regular_off', 'national_holiday'];
export const OFF_LABELS = { rest_day: '休息日', regular_off: '例假日', national_holiday: '國定假日' };

const hhmm = (t) => String(t).slice(0, 5);

// ---- 班別 -----------------------------------------------------------------------------

function parseShiftType(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new ScheduleError(400, '請輸入班別名稱');
  if (!TIME_RE.test(String(body.startTime)) || !TIME_RE.test(String(body.endTime))) throw new ScheduleError(400, '上下班時間格式必須是 HH:MM');
  if (body.startTime === body.endTime) throw new ScheduleError(400, '上班與下班時間不能相同');
  const breakMinutes = Number(body.breakMinutes ?? 60);
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) throw new ScheduleError(400, '休息時間必須是 0 到 240 分鐘的整數');
  // 簡稱：顯示在班表格子裡；沒填就用班別名稱的第一個字
  const shortName = String(body.shortName ?? '').trim();
  if ([...shortName].length > 4) throw new ScheduleError(400, '簡稱最多 4 個字');
  return [name, `${body.startTime}:00`, `${body.endTime}:00`, breakMinutes, body.active !== false, shortName || null];
}

// 班表格子上顯示的字
export const shiftLabel = (name, shortName) => (shortName || [...String(name || '')][0] || '');

// 既有部署不必手動套用 migration：啟動時補上新欄位（可重複執行）
export async function ensureScheduleSchema(pool) {
  await pool.execute('ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS shortName VARCHAR(4) NULL AFTER name');
  await pool.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS workTimeMode VARCHAR(10) NOT NULL DEFAULT 'standard'");
  await pool.execute('ALTER TABLE employees ADD COLUMN IF NOT EXISTS workTimeCycleStart DATE NULL');
}

// 工時制度：standard＝一般工時；flex2w＝二週變形工時（週期起算日往後每 14 天一個週期）
export const WORK_TIME_MODES = ['standard', 'flex2w'];
export function parseWorkTime(body) {
  if (body.workTimeMode === undefined) return null; // 沒帶＝不變更
  if (!WORK_TIME_MODES.includes(body.workTimeMode)) throw new ScheduleError(400, '工時制度不正確');
  if (body.workTimeMode === 'standard') return { mode: 'standard', cycleStart: null };
  if (!DATE_RE.test(String(body.workTimeCycleStart || ''))) throw new ScheduleError(400, '二週變形工時需要填寫週期起算日');
  return { mode: 'flex2w', cycleStart: body.workTimeCycleStart };
}

export async function listShiftTypes(pool) {
  const [rows] = await pool.execute('SELECT * FROM shift_types ORDER BY active DESC, startTime, id');
  return rows.map((r) => ({ ...r, shortName: r.shortName ?? '', label: shiftLabel(r.name, r.shortName), startTime: hhmm(r.startTime), endTime: hhmm(r.endTime), active: !!r.active, crossesMidnight: hhmm(r.endTime) < hhmm(r.startTime) }));
}

export async function createShiftType(pool, body) {
  const [result] = await pool.execute('INSERT INTO shift_types (name, startTime, endTime, breakMinutes, active, shortName) VALUES (?, ?, ?, ?, ?, ?)', parseShiftType(body));
  return result.insertId;
}

export async function updateShiftType(pool, id, body) {
  const [result] = await pool.execute('UPDATE shift_types SET name = ?, startTime = ?, endTime = ?, breakMinutes = ?, active = ?, shortName = ? WHERE id = ?', [...parseShiftType(body), id]);
  if (result.affectedRows === 0) throw new ScheduleError(404, '找不到該班別');
}

export async function deleteShiftType(pool, id) {
  const [[{ count }]] = await pool.execute('SELECT COUNT(*) AS count FROM work_schedules WHERE shiftTypeId = ?', [id]);
  if (count > 0) throw new ScheduleError(409, '這個班別已經被班表使用，無法刪除，請改為停用');
  const [result] = await pool.execute('DELETE FROM shift_types WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new ScheduleError(404, '找不到該班別');
}

// ---- 班表 -----------------------------------------------------------------------------

function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new ScheduleError(400, '月份格式不正確（需 YYYY-MM）');
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

const scheduleSelect = `
  SELECT s.id, s.employeeId, s.date, s.kind, s.shiftTypeId, s.offType, s.published,
         t.name AS shiftName, t.shortName, t.startTime, t.endTime, t.breakMinutes
  FROM work_schedules s LEFT JOIN shift_types t ON t.id = s.shiftTypeId`;

const toRow = ({ shortName, ...r }) => ({ ...r, shiftLabel: r.shiftName ? shiftLabel(r.shiftName, shortName) : null, published: !!r.published, startTime: r.startTime ? hhmm(r.startTime) : null, endTime: r.endTime ? hhmm(r.endTime) : null });

export async function getMonthSchedule(pool, month, department) {
  const { from, to } = monthRange(month);
  const params = [from, to];
  let deptClause = '';
  if (department) { deptClause = 'AND emp.department = ?'; params.push(department); }
  const [rows] = await pool.execute(
    `${scheduleSelect} JOIN employees emp ON emp.employeeId = s.employeeId
     WHERE s.date BETWEEN ? AND ? ${deptClause} ORDER BY s.employeeId, s.date`, params
  );
  const empParams = [to, from];
  let empDept = '';
  if (department) { empDept = 'AND department = ?'; empParams.push(department); }
  const [employees] = await pool.execute(
    `SELECT employeeId, name, department, scheduleMode, attendanceSource, workTimeMode, workTimeCycleStart FROM employees
     WHERE joinDate <= ? AND (active = TRUE OR terminationDate >= ?) ${empDept} ORDER BY employeeId`, empParams
  );
  return { employees, rows: rows.map(toRow), shiftTypes: await listShiftTypes(pool) };
}

// 員工自己看（只有已發布的）
export async function getMyPublishedSchedule(pool, employeeId, from, to) {
  if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to))) throw new ScheduleError(400, '日期格式不正確');
  const [rows] = await pool.execute(`${scheduleSelect} WHERE s.employeeId = ? AND s.published = TRUE AND s.date BETWEEN ? AND ? ORDER BY s.date`, [employeeId, from, to]);
  return rows.map(toRow);
}

// 依日期查多位員工的班表（打卡、缺卡偵測、薪資用）：Map<employeeId, Map<date, row>>
export async function getScheduleMap(pool, employeeIds, from, to) {
  const result = new Map();
  if (employeeIds.length === 0) return result;
  const [rows] = await pool.query(`${scheduleSelect} WHERE s.employeeId IN (?) AND s.date BETWEEN ? AND ?`, [employeeIds, from, to]);
  for (const r of rows.map(toRow)) {
    if (!result.has(r.employeeId)) result.set(r.employeeId, new Map());
    result.get(r.employeeId).set(r.date, r);
  }
  return result;
}

export async function getScheduleForDay(pool, employeeId, date) {
  const [rows] = await pool.execute(`${scheduleSelect} WHERE s.employeeId = ? AND s.date = ?`, [employeeId, date]);
  return rows[0] ? toRow(rows[0]) : null;
}

export function normalizeCell(cell) {
  if (!DATE_RE.test(String(cell.date || ''))) throw new ScheduleError(400, '日期格式不正確');
  if (cell.clear) return { employeeId: cell.employeeId, date: cell.date, clear: true };
  if (cell.kind === 'shift') {
    if (!Number.isInteger(Number(cell.shiftTypeId))) throw new ScheduleError(400, '請選擇班別');
    return { employeeId: cell.employeeId, date: cell.date, kind: 'shift', shiftTypeId: Number(cell.shiftTypeId), offType: null };
  }
  if (cell.kind === 'off') {
    if (!OFF_TYPES.includes(cell.offType)) throw new ScheduleError(400, '請選擇排休類別');
    return { employeeId: cell.employeeId, date: cell.date, kind: 'off', shiftTypeId: null, offType: cell.offType };
  }
  throw new ScheduleError(400, '班表內容不正確');
}

// 批次設定儲存格（新增、修改或清除）。已發布的格子被修改後維持發布狀態
export async function setCells(pool, actor, cells) {
  if (!Array.isArray(cells) || cells.length === 0) throw new ScheduleError(400, '沒有要儲存的班表');
  if (cells.length > 5000) throw new ScheduleError(400, '一次最多 5000 格');
  const normalized = cells.map(normalizeCell);
  const [employees] = await pool.query('SELECT employeeId FROM employees WHERE employeeId IN (?)', [[...new Set(normalized.map((c) => c.employeeId))]]);
  const known = new Set(employees.map((e) => e.employeeId));
  const unknown = [...new Set(normalized.map((c) => c.employeeId))].filter((id) => !known.has(id));
  if (unknown.length > 0) throw new ScheduleError(400, `找不到員工：${unknown.join('、')}`);

  let changed = 0;
  for (const c of normalized) {
    if (c.clear) {
      const [r] = await pool.execute('DELETE FROM work_schedules WHERE employeeId = ? AND date = ?', [c.employeeId, c.date]);
      changed += r.affectedRows;
    } else {
      await pool.execute(
        `INSERT INTO work_schedules (employeeId, date, kind, shiftTypeId, offType, updatedBy) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE kind = VALUES(kind), shiftTypeId = VALUES(shiftTypeId), offType = VALUES(offType), updatedBy = VALUES(updatedBy)`,
        [c.employeeId, c.date, c.kind, c.shiftTypeId, c.offType, actor]
      );
      changed += 1;
    }
  }
  return changed;
}

// 快速填入：把「員工 × 日期區間 × 星期」展開成儲存格清單（預覽與實際填入共用）
export function expandFillCells({ employeeIds, from, to, weekdays, kind, shiftTypeId, offType, clear }) {
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) throw new ScheduleError(400, '請選擇員工');
  if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to)) || from > to) throw new ScheduleError(400, '日期區間不正確');
  const days = (Array.isArray(weekdays) && weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5, 6, 7]).map(Number);
  const cells = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    const iso = d.toISOString().slice(0, 10);
    const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (!days.includes(weekday)) continue;
    for (const employeeId of employeeIds) cells.push({ employeeId, date: iso, kind, shiftTypeId, offType, clear });
  }
  if (cells.length === 0) throw new ScheduleError(400, '選擇的日期區間與星期內沒有任何日期');
  return cells;
}

// 快速填入：指定員工、日期區間與星期，一次填同一個班別或排休類別
export async function fillSchedule(pool, actor, params) {
  return setCells(pool, actor, expandFillCells(params));
}

// ---- 輪替樣式預排 ----------------------------------------------------------------------

export const MAX_PATTERN_LENGTH = 56;
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// 輪替樣式：樣式是一個 N 天的循環（每格是班別、排休或「不動」），從 anchor 當天起算第 1 天。
// 多位員工可分組錯開：每 groupSize 人一組，每一組往後錯開 offsetStep 天（0＝全員同步）。
// pattern 的每一格：{ kind:'shift', shiftTypeId } | { kind:'off', offType } | { kind:'skip' }
export async function expandPatternCells(pool, p) {
  const { employeeIds, from, to, pattern } = p || {};
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) throw new ScheduleError(400, '請選擇員工');
  if (employeeIds.length > 500) throw new ScheduleError(400, '一次最多預排 500 位員工');
  if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to)) || from > to) throw new ScheduleError(400, '日期區間不正確');
  if (dayDiff(from, to) > 92) throw new ScheduleError(400, '一次最多預排 93 天');
  if (!Array.isArray(pattern) || pattern.length < 1 || pattern.length > MAX_PATTERN_LENGTH) throw new ScheduleError(400, `輪替樣式需為 1 到 ${MAX_PATTERN_LENGTH} 天`);
  const anchor = p.anchor ? String(p.anchor) : from;
  if (!DATE_RE.test(anchor)) throw new ScheduleError(400, '週期起點日格式不正確');
  const groupSize = Number(p.groupSize) > 0 ? Math.floor(Number(p.groupSize)) : employeeIds.length;
  const offsetStep = Number.isFinite(Number(p.offsetStep)) ? Math.floor(Number(p.offsetStep)) : 0;
  if (offsetStep < 0 || offsetStep >= MAX_PATTERN_LENGTH) throw new ScheduleError(400, '錯開天數不正確');

  const steps = pattern.map((st) => {
    if (st?.kind === 'skip') return null;
    if (st?.kind === 'shift') {
      if (!Number.isInteger(Number(st.shiftTypeId))) throw new ScheduleError(400, '輪替樣式有未選班別的格子');
      return { kind: 'shift', shiftTypeId: Number(st.shiftTypeId), offType: null };
    }
    if (st?.kind === 'off' && OFF_TYPES.includes(st.offType)) return { kind: 'off', shiftTypeId: null, offType: st.offType };
    throw new ScheduleError(400, '輪替樣式內容不正確');
  });

  let existing = new Set();
  if (p.skipExisting) {
    const [rows] = await pool.query('SELECT employeeId, date FROM work_schedules WHERE employeeId IN (?) AND date BETWEEN ? AND ?', [employeeIds, from, to]);
    existing = new Set(rows.map((r) => `${r.employeeId}|${r.date}`));
  }

  const n = steps.length;
  const cells = [];
  employeeIds.forEach((employeeId, index) => {
    const offset = (Math.floor(index / groupSize) * offsetStep) % n;
    for (let d = from, guard = 0; d <= to && guard < 100; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10), guard += 1) {
      const step = steps[((dayDiff(anchor, d) + offset) % n + n) % n];
      if (!step || existing.has(`${employeeId}|${d}`)) continue;
      cells.push({ employeeId, date: d, ...step });
    }
  });
  if (cells.length === 0) throw new ScheduleError(400, '這個輪替樣式沒有任何要填入的格子');
  return cells;
}

// 發布：把整個月（可限定部門）的草稿班表變成員工看得到的
export async function publishSchedule(pool, month, department) {
  const { from, to } = monthRange(month);
  const params = [from, to];
  let join = '';
  let where = '';
  if (department) { join = 'JOIN employees emp ON emp.employeeId = s.employeeId'; where = 'AND emp.department = ?'; params.push(department); }
  const [result] = await pool.execute(
    `UPDATE work_schedules s ${join} SET s.published = TRUE WHERE s.published = FALSE AND s.date BETWEEN ? AND ? ${where}`, params
  );
  return result.affectedRows;
}
