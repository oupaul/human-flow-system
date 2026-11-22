// 人事成本：保險費率／級距表（CSV 匯入）與每月勞健退試算快照。
// 快照有兩種狀態：draft（草稿，可重新產生）與 locked（鎖定，凍結；只有 admin 能解除）。
// 試算使用「該月最後一天仍有效」的最新薪資紀錄，並且不處理當月到職／離職的按日折算（會在警告中提示）。

import * as XLSX from 'xlsx';
import { parseCsv } from './csv.js';
import { taipeiNow } from './punch.js';
import { RATE_KEYS, BRACKET_TYPES, calculateItem } from './insuranceCalc.js';
import {
  getSettings, payPeriodFor, classifyOvertimeDay, classifyScheduledDay, calculateOvertimePay, calculateLeaveDeduction,
  calculateAllowance, listAllowanceRules,
} from './payrollVariable.js';
import { getScheduleMap, OFF_LABELS } from './schedule.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidMonth(month) {
  return MONTH_RE.test(String(month || ''));
}

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // 當月最後一天
  return { start, end };
}

// ---- 費率／級距 CSV 匯入 ------------------------------------------------------------

function toRecords(csvText) {
  const rows = parseCsv(String(csvText || '').replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('CSV 內容是空的，至少需要標題列與一列資料');
  const header = rows[0].map((h) => h.trim());
  return { header, data: rows.slice(1) };
}

// 費率 CSV：effectiveDate,key,value[,note]。全部驗證通過才寫入（任何一列有錯就整份不匯入）
export async function importRatesCsv(pool, csvText) {
  const { header, data } = toRecords(csvText);
  const idx = { date: header.indexOf('effectiveDate'), key: header.indexOf('key'), value: header.indexOf('value'), note: header.indexOf('note') };
  if (idx.date < 0 || idx.key < 0 || idx.value < 0) throw new Error('標題列需包含 effectiveDate、key、value 欄位（note 選填）');

  const errors = [];
  const records = [];
  data.forEach((cells, i) => {
    const line = i + 2;
    const date = (cells[idx.date] || '').trim();
    const key = (cells[idx.key] || '').trim();
    const raw = (cells[idx.value] || '').trim();
    if (!DATE_RE.test(date)) errors.push(`第 ${line} 列：生效日格式不正確（需 YYYY-MM-DD）`);
    else if (!(key in RATE_KEYS)) errors.push(`第 ${line} 列：不認得的項目 key「${key}」`);
    else if (raw === '' || !Number.isFinite(Number(raw)) || Number(raw) < 0) errors.push(`第 ${line} 列：${key} 的值必須是 0 以上的數字`);
    else if (key.endsWith('Share') && Number(raw) > 100) errors.push(`第 ${line} 列：${key} 的負擔比例不可超過 100`);
    else records.push([date, key, Number(raw), idx.note >= 0 ? (cells[idx.note] || '').trim() || null : null]);
  });
  if (errors.length > 0) throw new Error(errors.slice(0, 10).join('；') + (errors.length > 10 ? `…（共 ${errors.length} 處）` : ''));
  if (records.length === 0) throw new Error('CSV 中沒有可匯入的資料');

  await pool.query(
    `INSERT INTO insurance_rates (effectiveDate, rateKey, value, note) VALUES ?
     ON DUPLICATE KEY UPDATE value = VALUES(value), note = VALUES(note)`,
    [records]
  );
  return { imported: records.length };
}

// 級距 CSV：effectiveDate,type,amount（type：labor／health／pension）。
// 同一個（生效日,類型）以整份取代：先刪掉舊的再寫入，確保級距表與官方公告一致
export async function importBracketsCsv(pool, csvText) {
  const { header, data } = toRecords(csvText);
  const idx = { date: header.indexOf('effectiveDate'), type: header.indexOf('type'), amount: header.indexOf('amount') };
  if (idx.date < 0 || idx.type < 0 || idx.amount < 0) throw new Error('標題列需包含 effectiveDate、type、amount 欄位');

  const errors = [];
  const groups = new Map(); // `${date}|${type}` → Set(amount)
  data.forEach((cells, i) => {
    const line = i + 2;
    const date = (cells[idx.date] || '').trim();
    const type = (cells[idx.type] || '').trim();
    const raw = (cells[idx.amount] || '').trim().replace(/,/g, '');
    if (!DATE_RE.test(date)) errors.push(`第 ${line} 列：生效日格式不正確`);
    else if (!BRACKET_TYPES.includes(type)) errors.push(`第 ${line} 列：type 必須是 labor、health 或 pension`);
    else if (!/^\d+$/.test(raw) || Number(raw) <= 0) errors.push(`第 ${line} 列：amount 必須是大於 0 的整數`);
    else {
      const k = `${date}|${type}`;
      if (!groups.has(k)) groups.set(k, new Set());
      groups.get(k).add(Number(raw));
    }
  });
  if (errors.length > 0) throw new Error(errors.slice(0, 10).join('；') + (errors.length > 10 ? `…（共 ${errors.length} 處）` : ''));
  if (groups.size === 0) throw new Error('CSV 中沒有可匯入的資料');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let imported = 0;
    for (const [k, amounts] of groups) {
      const [date, type] = k.split('|');
      await connection.execute('DELETE FROM insurance_brackets WHERE effectiveDate = ? AND bracketType = ?', [date, type]);
      await connection.query('INSERT INTO insurance_brackets (effectiveDate, bracketType, amount) VALUES ?', [[...amounts].map((a) => [date, type, a])]);
      imported += amounts.size;
    }
    await connection.commit();
    return { imported, sets: groups.size };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 某個月適用的費率：每個項目取「生效日 <= 該月 1 日」的最新一筆
export async function loadRatesForMonth(pool, month) {
  const { start } = monthRange(month);
  const [rows] = await pool.execute(
    `SELECT r.rateKey, r.value, r.effectiveDate FROM insurance_rates r
     WHERE r.effectiveDate = (SELECT MAX(r2.effectiveDate) FROM insurance_rates r2
                              WHERE r2.rateKey = r.rateKey AND r2.effectiveDate <= ?)`,
    [start]
  );
  const rates = {};
  const effective = {};
  for (const r of rows) { rates[r.rateKey] = Number(r.value); effective[r.rateKey] = r.effectiveDate; }
  const missing = Object.keys(RATE_KEYS).filter((k) => !(k in rates));
  return { rates, effective, missing };
}

async function loadBracketsForMonth(pool, month) {
  const { start } = monthRange(month);
  const [rows] = await pool.execute(
    `SELECT b.bracketType, b.amount FROM insurance_brackets b
     WHERE b.effectiveDate = (SELECT MAX(b2.effectiveDate) FROM insurance_brackets b2
                              WHERE b2.bracketType = b.bracketType AND b2.effectiveDate <= ?)
     ORDER BY b.amount`,
    [start]
  );
  const result = { labor: [], health: [], pension: [] };
  for (const r of rows) result[r.bracketType].push(Number(r.amount));
  return result;
}

// ---- 快照 ---------------------------------------------------------------------------

const ITEM_COLUMNS = ['monthlySalary', 'laborInsured', 'healthInsured', 'pensionWage', 'voluntaryPensionRate', 'healthDependents',
  'laborEmployee', 'laborEmployer', 'healthEmployee', 'healthEmployer', 'pensionEmployer', 'pensionEmployee',
  'overtimeHours', 'overtimePay', 'leaveDays', 'leaveDeduction', 'allowanceDays', 'allowancePay'];

export class PayrollError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// 載入計薪區間內已核准的加班（領加班費者）與請假，並檢查規則是否齊全：
// 倍率沒設定、請假用到的假別沒設扣薪比例，都直接報錯，不用預設值代替
async function loadVariableInputs(pool, period, employeeList, settings) {
  const employeeIds = new Set(employeeList.map((e) => e.employeeId));
  // 排班制員工（員工自己設定，沒設定就用公司預設）：日別與津貼依個人排班判斷
  const rotatingIds = new Set(employeeList.filter((e) => (e.scheduleMode ?? settings.defaultScheduleMode) === 'rotating').map((e) => e.employeeId));
  const [overtime] = await pool.execute(
    `SELECT o.id, o.employeeId, o.date, o.startTime, o.hours, o.onHoliday, h.name AS holidayName
     FROM overtime_applications o
     LEFT JOIN holidays h ON h.date = o.date AND h.isHoliday = TRUE
     WHERE o.status = 'approved' AND o.compensationType = 'pay' AND o.date BETWEEN ? AND ?`,
    [period.start, period.end]
  );
  const [leaves] = await pool.execute(
    `SELECT la.id, la.employeeId, la.leaveTypeId, la.startDate, la.endDate, la.days, lt.name AS leaveTypeName
     FROM leave_applications la JOIN leave_types lt ON lt.id = la.leaveTypeId
     WHERE la.status = 'approved' AND la.startDate BETWEEN ? AND ?`,
    [period.start, period.end]
  );
  const [tierRows] = await pool.execute('SELECT dayType, fromHours, toHours, multiplier FROM overtime_pay_rules');
  const [ratioRows] = await pool.execute('SELECT leaveTypeId, deductRatio FROM leave_type_deductions');

  const tiersByDay = {};
  for (const t of tierRows) {
    (tiersByDay[t.dayType] ||= []).push({ fromHours: Number(t.fromHours), toHours: t.toHours === null ? null : Number(t.toHours), multiplier: Number(t.multiplier) });
  }
  const ratioByType = {};
  for (const r of ratioRows) ratioByType[r.leaveTypeId] = Number(r.deductRatio);

  // 排班制員工的「每日排班與出勤」：系統班表為主（排班＝上班日、排休＝休息日／例假日／國定假日），
  // 沒有班表的日子退回外部匯入的考勤。合併後再疊上已核准的請假、公出。
  // 區間內完全沒有班表也沒有任何考勤的排班制員工，代表資料還沒建立，直接報錯指出是誰
  const attendanceByEmployee = new Map();
  let allowanceRules = [];
  const holidayNames = {};
  if (rotatingIds.size > 0) {
    const ids = [...rotatingIds];
    const [attendance] = await pool.query(
      `SELECT employeeId, date, shiftStart, status, note FROM attendance_records
       WHERE employeeId IN (?) AND date BETWEEN ? AND ? ORDER BY date`,
      [ids, period.start, period.end]
    );
    const schedules = await getScheduleMap(pool, ids, period.start, period.end);
    const [leaves2] = await pool.query(
      `SELECT employeeId, startDate, endDate FROM leave_applications WHERE status = 'approved' AND employeeId IN (?) AND startDate <= ? AND endDate >= ?`,
      [ids, period.end, period.start]
    );
    const [outings] = await pool.query(
      `SELECT employeeId, startDate, endDate FROM outing_applications WHERE status = 'approved' AND employeeId IN (?) AND startDate <= ? AND endDate >= ?`,
      [ids, period.end, period.start]
    );
    const covers = (list, id, date) => list.some((r) => r.employeeId === id && r.startDate <= date && r.endDate >= date);
    const attByKey = new Map(attendance.map((a) => [`${a.employeeId}|${a.date}`, a]));
    const dates = new Set();
    for (const a of attendance) dates.add(`${a.employeeId}|${a.date}`);
    for (const [id, m] of schedules) for (const d of m.keys()) dates.add(`${id}|${d}`);

    for (const key of [...dates].sort()) {
      const [employeeId, date] = key.split('|');
      const sched = schedules.get(employeeId)?.get(date);
      const att = attByKey.get(key);
      let row;
      if (sched?.kind === 'off') {
        row = { employeeId, date, status: 'day_off', note: OFF_LABELS[sched.offType] };
      } else if (sched?.kind === 'shift') {
        const status = covers(leaves2, employeeId, date) ? 'leave'
          : att && att.status !== 'day_off' && att.status !== 'leave' ? att.status
          : covers(outings, employeeId, date) ? 'normal' : 'scheduled';
        row = { employeeId, date, status, note: null };
      } else {
        row = att; // 沒有班表：用匯入的考勤（備援）
      }
      if (!attendanceByEmployee.has(employeeId)) attendanceByEmployee.set(employeeId, []);
      attendanceByEmployee.get(employeeId).push(row);
    }
    const noData = employeeList.filter((e) => rotatingIds.has(e.employeeId) && !attendanceByEmployee.has(e.employeeId));
    if (noData.length > 0) {
      throw new PayrollError(400, `排班制員工在計薪區間 ${period.start} ~ ${period.end} 內沒有任何班表或考勤資料，請先建立班表或匯入該期間的考勤：${noData.map((e) => `${e.name}（${e.employeeId}）`).join('、')}`);
    }
    allowanceRules = (await listAllowanceRules(pool)).filter((r) => r.active);
    const [holidays] = await pool.execute(
      `SELECT date, name FROM holidays WHERE isHoliday = TRUE AND name IS NOT NULL AND name <> '' AND date BETWEEN ? AND ?`,
      [period.start, period.end]
    );
    for (const h of holidays) holidayNames[h.date] = h.name;
  }
  const scheduleDay = (employeeId) => {
    const byDate = new Map((attendanceByEmployee.get(employeeId) ?? []).map((a) => [a.date, a]));
    return (application) => classifyScheduledDay(byDate.get(application.date) ?? null);
  };

  const overtimeByEmployee = new Map();
  const neededDayTypes = new Set();
  for (const o of overtime) {
    if (!employeeIds.has(o.employeeId)) continue;
    if (!overtimeByEmployee.has(o.employeeId)) overtimeByEmployee.set(o.employeeId, []);
    overtimeByEmployee.get(o.employeeId).push(o);
    const dayType = rotatingIds.has(o.employeeId) ? scheduleDay(o.employeeId)(o) : classifyOvertimeDay(o);
    if (dayType) neededDayTypes.add(dayType);
  }
  const missingTiers = [...neededDayTypes].filter((d) => !tiersByDay[d]);
  if (missingTiers.length > 0) {
    throw new PayrollError(400, `計薪區間內有領加班費的加班，但尚未設定加班費倍率（${missingTiers.join('、')}）。請先到「計薪規則」設定或載入範本。`);
  }

  const leaveByEmployee = new Map();
  const missingLeaveTypes = new Map();
  for (const l of leaves) {
    if (!employeeIds.has(l.employeeId)) continue;
    if (!leaveByEmployee.has(l.employeeId)) leaveByEmployee.set(l.employeeId, []);
    leaveByEmployee.get(l.employeeId).push(l);
    if (!(l.leaveTypeId in ratioByType)) missingLeaveTypes.set(l.leaveTypeId, l.leaveTypeName);
  }
  if (missingLeaveTypes.size > 0) {
    throw new PayrollError(400, `計薪區間內用到的假別尚未設定扣薪比例：${[...missingLeaveTypes.values()].join('、')}。請先到「計薪規則」設定。`);
  }
  return { overtimeByEmployee, leaveByEmployee, tiersByDay, ratioByType, rotatingIds, attendanceByEmployee, allowanceRules, holidayNames, scheduleDay };
}

// 產生（或重新產生草稿）某月的試算快照。已鎖定的月份不能重新產生
export async function generateSnapshot(pool, month, username) {
  if (!isValidMonth(month)) throw new PayrollError(400, '月份格式不正確（需 YYYY-MM）');
  const currentMonth = taipeiNow().date.slice(0, 7);
  if (month > currentMonth) throw new PayrollError(400, '不能產生未來月份的試算');

  const [existing] = await pool.execute('SELECT id, status FROM payroll_snapshots WHERE month = ?', [month]);
  if (existing[0]?.status === 'locked') throw new PayrollError(409, `${month} 已鎖定，如需重新產生請先由管理者解除鎖定`);

  const { rates, effective, missing } = await loadRatesForMonth(pool, month);
  if (missing.length > 0) {
    throw new PayrollError(400, `缺少 ${month} 適用的費率設定：${missing.map((k) => `${k}（${RATE_KEYS[k]}）`).join('、')}。請先到「費率與級距」匯入。`);
  }
  const brackets = await loadBracketsForMonth(pool, month);
  const { start, end } = monthRange(month);

  const [employees] = await pool.execute(
    `SELECT employeeId, name, department, joinDate, terminationDate, scheduleMode FROM employees
     WHERE joinDate <= ? AND (active = TRUE OR (terminationDate IS NOT NULL AND terminationDate >= ?))
     ORDER BY employeeId`,
    [end, start]
  );
  const [comps] = await pool.execute(
    `SELECT c.* FROM employee_compensation c
     WHERE c.effectiveDate = (SELECT MAX(c2.effectiveDate) FROM employee_compensation c2
                              WHERE c2.employeeId = c.employeeId AND c2.effectiveDate <= ?)`,
    [end]
  );
  const compByEmployee = new Map(comps.map((c) => [c.employeeId, c]));

  // 計薪區間內的加班與請假（底薪、勞健退仍是完整日曆月，只有這兩項取區間）
  const settings = await getSettings(pool);
  const period = payPeriodFor(month, settings.cutoffDay);
  const variable = await loadVariableInputs(pool, period, employees, settings);

  const items = employees.map((e) => {
    const comp = compByEmployee.get(e.employeeId) ?? null;
    const item = calculateItem(comp, rates, brackets);
    if (e.joinDate > start) item.warnings.push('當月到職，未依天數折算');
    if (e.terminationDate && e.terminationDate >= start && e.terminationDate < end) item.warnings.push('當月離職，未依天數折算');

    const ot = variable.overtimeByEmployee.get(e.employeeId) ?? [];
    const lv = variable.leaveByEmployee.get(e.employeeId) ?? [];
    const rotating = variable.rotatingIds.has(e.employeeId);
    item.overtimeHours = null; item.overtimePay = null; item.leaveDays = null; item.leaveDeduction = null;
    item.allowanceDays = null; item.allowancePay = null;
    const detailParts = {};

    if (rotating) {
      // 排班制：假日津貼依個人排班（排定在指定日別上班且有出勤）計算，不需要薪資紀錄
      const al = calculateAllowance(variable.attendanceByEmployee.get(e.employeeId) ?? [], variable.allowanceRules, variable.holidayNames);
      if (variable.allowanceRules.length > 0) {
        item.allowanceDays = al.days; item.allowancePay = al.pay;
        item.warnings.push(...al.warnings);
        detailParts.allowance = al.lines;
      }
    }
    if (comp && (ot.length > 0 || lv.length > 0)) {
      const daily = comp.monthlySalary / settings.daysPerMonth;
      const hourly = daily / settings.hoursPerDay;
      const o = calculateOvertimePay(ot, variable.tiersByDay, hourly, rotating ? variable.scheduleDay(e.employeeId) : undefined);
      const l = calculateLeaveDeduction(lv, variable.ratioByType, daily, period);
      item.overtimeHours = o.hours; item.overtimePay = o.pay; item.leaveDays = l.days; item.leaveDeduction = l.deduction;
      item.warnings.push(...o.warnings, ...l.warnings);
      detailParts.overtime = o.lines; detailParts.leave = l.lines;
    } else if (!comp && (ot.length > 0 || lv.length > 0)) {
      item.warnings.push('計薪區間內有加班或請假，但找不到薪資紀錄，加班費與請假扣薪未計算');
    }
    if (rotating) item.warnings.unshift('排班制：日別與津貼依個人排班判斷');
    const detail = Object.keys(detailParts).length > 0 ? JSON.stringify(detailParts) : null;
    return { employeeId: e.employeeId, employeeName: e.name, department: e.department, ...item, variableDetail: detail };
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let snapshotId = existing[0]?.id;
    const ratesUsed = JSON.stringify({ rates, effectiveDates: effective, variable: { settings, period, tiers: variable.tiersByDay, leaveRatios: variable.ratioByType, allowanceRules: variable.allowanceRules } });
    if (snapshotId) {
      await connection.execute('DELETE FROM payroll_snapshot_items WHERE snapshotId = ?', [snapshotId]);
      await connection.execute(
        'UPDATE payroll_snapshots SET ratesUsed = ?, headcount = ?, generatedAt = NOW(), generatedBy = ?, periodStart = ?, periodEnd = ? WHERE id = ?',
        [ratesUsed, items.length, username, period.start, period.end, snapshotId]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO payroll_snapshots (month, status, ratesUsed, headcount, generatedAt, generatedBy, periodStart, periodEnd) VALUES (?, 'draft', ?, ?, NOW(), ?, ?, ?)`,
        [month, ratesUsed, items.length, username, period.start, period.end]
      );
      snapshotId = result.insertId;
    }
    if (items.length > 0) {
      await connection.query(
        `INSERT INTO payroll_snapshot_items (snapshotId, employeeId, employeeName, department, ${ITEM_COLUMNS.join(', ')}, variableDetail, warnings) VALUES ?`,
        [items.map((i) => [snapshotId, i.employeeId, i.employeeName, i.department, ...ITEM_COLUMNS.map((c) => i[c] ?? null), i.variableDetail ?? null, i.warnings.join('；') || null])]
      );
    }
    await connection.commit();
    return { month, headcount: items.length, warnings: items.filter((i) => i.warnings.length > 0).length, periodStart: period.start, periodEnd: period.end };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

// 每位員工：員工自付勞健退、公司負擔勞健退、應發薪資（月薪＋加班費－請假扣薪）、實領（應發－員工自付）。
// 實領只扣勞健退（自提），不含所得稅等其他扣項。沒有月薪（沒有薪資紀錄）的員工，應發與實領為 null
function decorateItem(i) {
  const sumOrNull = (parts) => (parts.every((p) => p === null || p === undefined) ? null : parts.reduce((t, p) => t + num(p), 0));
  const employeeInsurance = sumOrNull([i.laborEmployee, i.healthEmployee, i.pensionEmployee]);
  const employerInsurance = sumOrNull([i.laborEmployer, i.healthEmployer, i.pensionEmployer]);
  const hasSalary = i.monthlySalary !== null && i.monthlySalary !== undefined;
  const grossPay = hasSalary ? num(i.monthlySalary) + num(i.overtimePay) + num(i.allowancePay) - num(i.leaveDeduction) : null;
  return { ...i, employeeInsurance, employerInsurance, grossPay, netPay: grossPay === null ? null : grossPay - num(employeeInsurance) };
}

function computeTotals(items) {
  const sum = (key) => items.reduce((t, i) => t + num(i[key]), 0);
  const salary = sum('monthlySalary');
  const overtimePay = sum('overtimePay');
  const allowancePay = sum('allowancePay');
  const leaveDeduction = sum('leaveDeduction');
  const employee = sum('employeeInsurance');
  const employer = sum('employerInsurance');
  const gross = salary + overtimePay + allowancePay - leaveDeduction;
  return { salary, overtimePay, allowancePay, leaveDeduction, gross, employee, employer, net: gross - employee, totalCost: gross + employer };
}

export async function listSnapshots(pool) {
  const [snapshots] = await pool.execute('SELECT * FROM payroll_snapshots ORDER BY month DESC');
  if (snapshots.length === 0) return [];
  const [items] = await pool.query('SELECT * FROM payroll_snapshot_items WHERE snapshotId IN (?)', [snapshots.map((s) => s.id)]);
  const bySnapshot = new Map();
  for (const i of items) {
    if (!bySnapshot.has(i.snapshotId)) bySnapshot.set(i.snapshotId, []);
    bySnapshot.get(i.snapshotId).push(decorateItem(i));
  }
  return snapshots.map((s) => {
    const t = computeTotals(bySnapshot.get(s.id) ?? []);
    return { ...s, salary: t.salary, overtimePay: t.overtimePay, allowancePay: t.allowancePay, leaveDeduction: t.leaveDeduction, employeeTotal: t.employee, employerTotal: t.employer, netTotal: t.net, totalCost: t.totalCost };
  });
}

export async function getSnapshot(pool, month) {
  const [snaps] = await pool.execute('SELECT * FROM payroll_snapshots WHERE month = ?', [month]);
  if (!snaps[0]) return null;
  const [rows] = await pool.execute('SELECT * FROM payroll_snapshot_items WHERE snapshotId = ? ORDER BY employeeId', [snaps[0].id]);
  const items = rows.map(decorateItem);
  return { ...snaps[0], items, totals: computeTotals(items) };
}

export async function setSnapshotLock(pool, month, lock, username) {
  const [rows] = await pool.execute('SELECT id, status FROM payroll_snapshots WHERE month = ?', [month]);
  if (!rows[0]) throw new PayrollError(404, '找不到該月份的快照');
  if (lock && rows[0].status === 'locked') throw new PayrollError(409, '該月份已經鎖定');
  if (!lock && rows[0].status === 'draft') throw new PayrollError(409, '該月份目前不是鎖定狀態');
  if (lock) {
    await pool.execute(`UPDATE payroll_snapshots SET status = 'locked', lockedAt = NOW(), lockedBy = ? WHERE id = ?`, [username, rows[0].id]);
  } else {
    await pool.execute(`UPDATE payroll_snapshots SET status = 'draft', lockedAt = NULL, lockedBy = NULL WHERE id = ?`, [rows[0].id]);
  }
}

export async function deleteDraftSnapshot(pool, month) {
  const [rows] = await pool.execute('SELECT id, status FROM payroll_snapshots WHERE month = ?', [month]);
  if (!rows[0]) throw new PayrollError(404, '找不到該月份的快照');
  if (rows[0].status === 'locked') throw new PayrollError(409, '已鎖定的快照不能刪除，請先解除鎖定');
  await pool.execute('DELETE FROM payroll_snapshots WHERE id = ?', [rows[0].id]);
}

// 匯出 Excel：明細、合計與費率、加班請假明細（逐筆，供核對）
export function snapshotToXlsx(snapshot) {
  const header = ['員工編號', '姓名', '部門', '月薪', '加班時數', '加班費', '津貼天數', '津貼', '請假扣薪天數', '請假扣款', '應發薪資',
    '勞保投保薪資', '健保投保薪資', '勞退提繳工資', '自提率(%)', '健保眷屬',
    '勞保-員工', '勞保-公司', '健保-員工', '健保-公司', '勞退-公司', '勞退-員工自提',
    '員工自付合計', '實領(扣勞健退後)', '公司負擔合計', '公司總成本', '警告'];
  const n = (v) => (v === null || v === undefined ? '' : Number(v));
  const rows = snapshot.items.map((i) => [
    i.employeeId, i.employeeName, i.department, n(i.monthlySalary), n(i.overtimeHours), n(i.overtimePay), n(i.allowanceDays), n(i.allowancePay), n(i.leaveDays), n(i.leaveDeduction), n(i.grossPay),
    n(i.laborInsured), n(i.healthInsured), n(i.pensionWage), n(i.voluntaryPensionRate), n(i.healthDependents),
    n(i.laborEmployee), n(i.laborEmployer), n(i.healthEmployee), n(i.healthEmployer), n(i.pensionEmployer), n(i.pensionEmployee),
    n(i.employeeInsurance), n(i.netPay), n(i.employerInsurance), i.grossPay === null ? '' : i.grossPay + num(i.employerInsurance), i.warnings || '',
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const t = snapshot.totals;
  const used = JSON.parse(snapshot.ratesUsed || '{}');
  const summary = [
    ['月份', snapshot.month], ['狀態', snapshot.status === 'locked' ? '已鎖定' : '草稿'], ['人數', snapshot.headcount],
    ['請假、加班計薪區間', snapshot.periodStart && snapshot.periodEnd ? `${snapshot.periodStart} ~ ${snapshot.periodEnd}` : ''],
    ['月薪合計', t.salary], ['加班費合計', t.overtimePay], ['津貼合計', t.allowancePay], ['請假扣款合計', t.leaveDeduction], ['應發薪資合計', t.gross],
    ['員工自付(勞健退)合計', t.employee], ['實領合計(扣勞健退後)', t.net], ['公司負擔(勞健退)合計', t.employer], ['公司總成本', t.totalCost], [],
    ['使用的費率（產生當下）'],
    ...Object.entries(used.rates || {}).map(([k, v]) => [RATE_KEYS[k] || k, v]), [],
    ['注意：試算值僅供參考；實領只扣勞健退，未含所得稅等其他扣項；底薪與勞健退按整個日曆月，當月到職／離職未按天數折算。'],
  ];
  const detailHeader = ['員工編號', '姓名', '類別', '日期', '時數／天數', '日別／假別', '倍率／扣薪比例', '金額'];
  const detailRows = [];
  for (const i of snapshot.items) {
    if (!i.variableDetail) continue;
    const d = JSON.parse(i.variableDetail);
    for (const o of d.overtime || []) detailRows.push([i.employeeId, i.employeeName, '加班費', o.date, o.hours, o.dayType, o.factor, o.amount]);
    for (const l of d.leave || []) detailRows.push([i.employeeId, i.employeeName, '請假', l.date, l.days, l.leaveType, l.ratio, -l.amount]);
    for (const a of d.allowance || []) detailRows.push([i.employeeId, i.employeeName, '津貼', a.date, 1, a.rule, '', a.amount]);
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '明細');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), '合計與費率');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]), '加班請假明細');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function listRates(pool) {
  const [rows] = await pool.execute('SELECT effectiveDate, rateKey, value, note FROM insurance_rates ORDER BY effectiveDate DESC, rateKey');
  return rows.map((r) => ({ ...r, label: RATE_KEYS[r.rateKey] || r.rateKey }));
}

export async function listBracketSets(pool) {
  const [rows] = await pool.execute(
    `SELECT effectiveDate, bracketType, COUNT(*) AS count, MIN(amount) AS minAmount, MAX(amount) AS maxAmount
     FROM insurance_brackets GROUP BY effectiveDate, bracketType ORDER BY effectiveDate DESC, bracketType`
  );
  return rows;
}
