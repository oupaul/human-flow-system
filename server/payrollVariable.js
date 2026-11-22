// 薪資計算中「隨月變動」的部分：計薪區間內已核准的加班費與請假扣薪。
// 底薪與勞健退照舊按完整日曆月；只有請假、加班取「上月 (cutoffDay+1) 日 ~ 本月 cutoffDay 日」。
// 倍率、扣薪比例、日薪時薪基準全部由 HR 設定（系統不內建，載入範本也只是預填，要自行確認）。
// 試算值僅供參考，實際發放以公司薪資作業為準。

import { parseCsv } from './csv.js';

export const DAY_TYPES = ['weekday', 'rest_day', 'holiday'];

// 勞基法倍率範本（僅供預填，請依公司規定與最新法規確認後調整）：
//   平日：前 2 小時 1.34、之後 1.67
//   休息日：前 2 小時 1.34、第 3~8 小時 1.67、第 9 小時起 2.67
//   國定假日：月薪制已含當日工資，出勤另加發 1 日（前 8 小時 1.0），超過 8 小時再依 1.34、1.67 計
export const OVERTIME_TEMPLATE = [
  ['weekday', 0, 2, 1.34], ['weekday', 2, null, 1.67],
  ['rest_day', 0, 2, 1.34], ['rest_day', 2, 8, 1.67], ['rest_day', 8, null, 2.67],
  ['holiday', 0, 8, 1.0], ['holiday', 8, 10, 1.34], ['holiday', 10, null, 1.67],
];

// ---- 計薪區間 -------------------------------------------------------------------------

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// 薪資月份 M 的請假、加班區間：上月 (cutoffDay+1) 日 ~ 本月 cutoffDay 日。
// 上月的結束日 = (M-1) 月的 cutoffDay 日，起日是它的隔天，因此任何 cutoffDay 都不會漏算或重複
export function payPeriodFor(month, cutoffDay) {
  const [y, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, cutoffDay));
  const prevEnd = new Date(Date.UTC(y, m - 2, cutoffDay));
  const start = new Date(prevEnd.getTime() + 24 * 60 * 60 * 1000);
  return { start: ymd(start), end: ymd(end) };
}

// ---- 加班費 ---------------------------------------------------------------------------

// 平日／休息日／國定假日：沒有出勤在假日的就是平日；假日出勤且行事曆上有節日名稱視為國定假日，其餘視為休息日
export function classifyOvertimeDay(application) {
  if (!application.onHoliday) return 'weekday';
  return application.holidayName ? 'holiday' : 'rest_day';
}

// 把 hours 小時（從當天已累計的 offset 小時之後開始）依分段倍率分配，回傳「倍率加權小時數」
function weightedHours(offset, hours, tiers) {
  let remaining = hours;
  let cursor = offset;
  let weighted = 0;
  for (const tier of tiers) {
    if (remaining <= 1e-9) break;
    const tierEnd = tier.toHours ?? Infinity;
    if (cursor >= tierEnd) continue;
    const covered = Math.min(remaining, tierEnd - Math.max(cursor, tier.fromHours));
    if (covered <= 0) continue;
    weighted += covered * tier.multiplier;
    remaining -= covered;
    cursor += covered;
  }
  return { weighted, uncovered: Math.max(0, remaining) };
}

// applications：已核准且選擇領加班費的加班（需含 holidayName）；tiersByDay：{dayType: [{fromHours,toHours,multiplier}]}
// 同一天的多筆加班依開始時間合併累計時數後再套分段倍率
export function calculateOvertimePay(applications, tiersByDay, hourlyWage, classify = classifyOvertimeDay) {
  const warnings = [];
  const lines = [];
  const byDate = new Map();
  for (const a of applications) {
    if (!byDate.has(a.date)) byDate.set(a.date, []);
    byDate.get(a.date).push(a);
  }
  let hours = 0;
  let amount = 0;
  for (const [date, list] of [...byDate.entries()].sort()) {
    list.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    let offset = 0;
    for (const a of list) {
      const dayType = classify(a);
      if (!dayType) {
        warnings.push(`${date} 加班 ${a.hours} 小時：找不到該日的排班／考勤資料，無法判斷日別，未計入`);
        continue;
      }
      const tiers = (tiersByDay[dayType] || []).slice().sort((x, y) => x.fromHours - y.fromHours);
      const { weighted, uncovered } = weightedHours(offset, a.hours, tiers);
      if (uncovered > 0) warnings.push(`${date} 加班 ${a.hours} 小時有 ${uncovered} 小時超出「${dayType}」已設定的倍率區間，未計入`);
      const pay = weighted * hourlyWage;
      lines.push({ id: a.id, date, hours: a.hours, dayType, factor: Math.round(weighted * 1000) / 1000, amount: Math.round(pay) });
      hours += a.hours;
      amount += pay;
      offset += a.hours;
    }
  }
  return { hours, pay: Math.round(amount), lines, warnings };
}

// ---- 排班制 ---------------------------------------------------------------------------

// 排班制：休息日、例假日、國定假日都只是平移，日別完全依個人當天的排班判斷，不看行事曆。
//   排定上班（有班別、不是休息標記）＝一般上班日（即使是週六日或國定假日）
//   排定休息：標記「國定假日」→ holiday；「例假日」→ holiday（例假日出勤同樣加倍發給）；「休息日」或其他 → rest_day
// attendanceRow 為 null（那天沒有考勤／排班資料）時回傳 null，呼叫端不可猜測
export function classifyScheduledDay(attendanceRow) {
  if (!attendanceRow) return null;
  if (attendanceRow.status !== 'day_off') return 'weekday';
  return ['國定假日', '例假日'].includes(attendanceRow.note) ? 'holiday' : 'rest_day';
}

export function isoWeekday(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

// 排班制假日津貼：排定上班的日子落在規則指定的星期（或行事曆上有節日名稱的日子）就額外給固定金額。
//   請假日、排定休息日不給；規則要求實際出勤時，缺卡也不給並提示。同一天符合多條規則則各自計算
export function calculateAllowance(attendanceRows, rules, holidayNames) {
  const lines = [];
  const warnings = [];
  const days = new Set();
  let amount = 0;
  for (const row of attendanceRows) {
    if (row.status === 'day_off' || row.status === 'leave') continue;
    const weekday = isoWeekday(row.date);
    for (const rule of rules) {
      const matchesWeekday = rule.weekdays.includes(weekday);
      const matchesHoliday = rule.includeNationalHolidays && !!holidayNames[row.date];
      if (!matchesWeekday && !matchesHoliday) continue;
      if (rule.requireAttendance && row.status !== 'normal') {
        if (row.status === 'missing') warnings.push(`${row.date} 排班在「${rule.name}」適用日但缺卡，津貼未計`);
        continue;
      }
      lines.push({ date: row.date, rule: rule.name, amount: rule.amount });
      days.add(row.date);
      amount += rule.amount;
    }
  }
  return { days: days.size, pay: amount, lines, warnings };
}

// ---- 請假扣薪 -------------------------------------------------------------------------

// applications：已核准、起日落在計薪區間內的請假（需含 leaveTypeName）；ratioByType：{leaveTypeId: 扣薪比例}
// 跨區間的請假整筆算在「起日所在區間」，並在警告中提示
export function calculateLeaveDeduction(applications, ratioByType, dailyWage, period) {
  const warnings = [];
  const lines = [];
  let days = 0;
  let amount = 0;
  for (const a of applications) {
    const ratio = ratioByType[a.leaveTypeId] ?? 0;
    const deduction = a.days * ratio * dailyWage;
    lines.push({ id: a.id, date: a.startDate, endDate: a.endDate, days: a.days, leaveType: a.leaveTypeName, ratio, amount: Math.round(deduction) });
    if (ratio > 0) days += a.days; // 只統計實際會扣薪的天數，有薪假（特休等）只列在明細裡
    amount += deduction;
    if (a.endDate > period.end) warnings.push(`${a.leaveTypeName} ${a.startDate}～${a.endDate} 跨出計薪區間，整筆算在起日所在區間`);
  }
  return { days, deduction: Math.round(amount), lines, warnings };
}

// ---- 規則維護 -------------------------------------------------------------------------

export async function getSettings(pool) {
  const [rows] = await pool.execute('SELECT cutoffDay, daysPerMonth, hoursPerDay, defaultScheduleMode FROM payroll_settings WHERE id = 1');
  return rows[0] || { cutoffDay: 25, daysPerMonth: 30, hoursPerDay: 8, defaultScheduleMode: 'fixed' };
}

export async function saveSettings(pool, body) {
  const cutoffDay = Number(body.cutoffDay);
  const daysPerMonth = Number(body.daysPerMonth);
  const hoursPerDay = Number(body.hoursPerDay);
  const defaultScheduleMode = body.defaultScheduleMode === 'rotating' ? 'rotating' : 'fixed';
  if (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 28) throw new Error('截止日必須是 1 到 28 的整數');
  if (!Number.isInteger(daysPerMonth) || daysPerMonth < 20 || daysPerMonth > 31) throw new Error('每月天數必須是 20 到 31 的整數');
  if (!Number.isInteger(hoursPerDay) || hoursPerDay < 1 || hoursPerDay > 12) throw new Error('每日工時必須是 1 到 12 的整數');
  await pool.execute(
    `INSERT INTO payroll_settings (id, cutoffDay, daysPerMonth, hoursPerDay, defaultScheduleMode) VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE cutoffDay = VALUES(cutoffDay), daysPerMonth = VALUES(daysPerMonth),
       hoursPerDay = VALUES(hoursPerDay), defaultScheduleMode = VALUES(defaultScheduleMode)`,
    [cutoffDay, daysPerMonth, hoursPerDay, defaultScheduleMode]
  );
}

export async function listOvertimeRules(pool) {
  const [rows] = await pool.execute('SELECT dayType, fromHours, toHours, multiplier FROM overtime_pay_rules ORDER BY FIELD(dayType, "weekday", "rest_day", "holiday"), fromHours');
  return rows;
}

// 驗證每種日別的分段：從 0 開始、連續、不重疊，只有最後一段可以沒有上限
function validateTiers(rows) {
  const errors = [];
  const byDay = {};
  for (const r of rows) (byDay[r.dayType] ||= []).push(r);
  for (const [day, list] of Object.entries(byDay)) {
    list.sort((a, b) => a.fromHours - b.fromHours);
    if (list[0].fromHours !== 0) errors.push(`${day}：第一段必須從 0 小時開始`);
    list.forEach((t, i) => {
      if (t.toHours !== null && t.toHours <= t.fromHours) errors.push(`${day}：${t.fromHours} 小時起的區間結束時數必須大於起始時數`);
      const next = list[i + 1];
      if (t.toHours === null && next) errors.push(`${day}：沒有上限的區間必須是最後一段`);
      if (next && t.toHours !== null && next.fromHours !== t.toHours) errors.push(`${day}：${t.toHours} 小時處與下一段不連續或重疊`);
    });
  }
  return errors;
}

async function replaceOvertimeRules(pool, rows) {
  const errors = validateTiers(rows);
  if (errors.length > 0) throw new Error(errors.join('；'));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM overtime_pay_rules');
    await connection.query('INSERT INTO overtime_pay_rules (dayType, fromHours, toHours, multiplier) VALUES ?',
      [rows.map((r) => [r.dayType, r.fromHours, r.toHours, r.multiplier])]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// CSV：dayType,fromHours,toHours,multiplier（toHours 留空表示沒有上限）。整份取代，任何一列有誤都不匯入
export async function importOvertimeRulesCsv(pool, csvText) {
  const rows = parseCsv(String(csvText || '').replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('CSV 內容是空的，至少需要標題列與一列資料');
  const header = rows[0].map((h) => h.trim());
  const idx = { day: header.indexOf('dayType'), from: header.indexOf('fromHours'), to: header.indexOf('toHours'), mult: header.indexOf('multiplier') };
  if (Object.values(idx).some((i) => i < 0)) throw new Error('標題列需包含 dayType、fromHours、toHours、multiplier');
  const errors = [];
  const parsed = [];
  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const dayType = (cells[idx.day] || '').trim();
    const from = Number((cells[idx.from] || '').trim());
    const toRaw = (cells[idx.to] || '').trim();
    const mult = Number((cells[idx.mult] || '').trim());
    if (!DAY_TYPES.includes(dayType)) errors.push(`第 ${line} 列：dayType 必須是 weekday、rest_day 或 holiday`);
    else if (!Number.isFinite(from) || from < 0 || (cells[idx.from] || '').trim() === '') errors.push(`第 ${line} 列：fromHours 必須是 0 以上的數字`);
    else if (toRaw !== '' && (!Number.isFinite(Number(toRaw)) || Number(toRaw) <= 0)) errors.push(`第 ${line} 列：toHours 必須是大於 0 的數字或留空`);
    else if (!Number.isFinite(mult) || mult <= 0) errors.push(`第 ${line} 列：multiplier 必須是大於 0 的數字`);
    else parsed.push({ dayType, fromHours: from, toHours: toRaw === '' ? null : Number(toRaw), multiplier: mult });
  });
  if (errors.length > 0) throw new Error(errors.slice(0, 10).join('；') + (errors.length > 10 ? `…（共 ${errors.length} 處）` : ''));
  await replaceOvertimeRules(pool, parsed);
  return { imported: parsed.length };
}

// 載入勞基法範本：只有目前沒有任何倍率時才允許，避免誤蓋掉 HR 已調整的設定
export async function loadOvertimeTemplate(pool) {
  const [[{ count }]] = await pool.execute('SELECT COUNT(*) AS count FROM overtime_pay_rules');
  if (count > 0) throw new Error('目前已有加班費倍率設定，不能載入範本；如要重來請改用 CSV 整份取代');
  await replaceOvertimeRules(pool, OVERTIME_TEMPLATE.map(([dayType, fromHours, toHours, multiplier]) => ({ dayType, fromHours, toHours, multiplier })));
  return { imported: OVERTIME_TEMPLATE.length };
}

export async function listLeaveDeductions(pool) {
  const [rows] = await pool.execute(
    `SELECT lt.id AS leaveTypeId, lt.name, lt.isPaid, d.deductRatio
     FROM leave_types lt LEFT JOIN leave_type_deductions d ON d.leaveTypeId = lt.id ORDER BY lt.id`
  );
  return rows.map((r) => ({ ...r, isPaid: !!r.isPaid, deductRatio: r.deductRatio === null ? null : Number(r.deductRatio) }));
}

export async function saveLeaveDeductions(pool, items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('沒有要儲存的設定');
  for (const i of items) {
    const ratio = Number(i.deductRatio);
    if (!Number.isInteger(Number(i.leaveTypeId)) || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
      throw new Error('扣薪比例必須介於 0（不扣）到 1（全扣）');
    }
  }
  await pool.query(
    `INSERT INTO leave_type_deductions (leaveTypeId, deductRatio) VALUES ?
     ON DUPLICATE KEY UPDATE deductRatio = VALUES(deductRatio)`,
    [items.map((i) => [Number(i.leaveTypeId), Number(i.deductRatio)])]
  );
}

// 為還沒設定的假別，依「是否有薪」標記預填：有薪 0、無薪 1（半薪等請 HR 自行調整）
export async function prefillLeaveDeductions(pool) {
  const [result] = await pool.execute(
    `INSERT IGNORE INTO leave_type_deductions (leaveTypeId, deductRatio)
     SELECT id, IF(isPaid, 0, 1) FROM leave_types`
  );
  return { added: result.affectedRows };
}

// ---- 假日津貼規則 -----------------------------------------------------------------------

function parseAllowanceRule(body) {
  const name = String(body.name || '').trim();
  const rawWeekdays = Array.isArray(body.weekdays) ? body.weekdays : String(body.weekdays || '').split(',');
  const weekdays = [...new Set(rawWeekdays.filter((w) => w !== '' && w !== null && w !== undefined).map(Number))];
  const amount = Number(body.amount);
  if (!name) throw new Error('請輸入津貼名稱');
  if (weekdays.some((w) => !Number.isInteger(w) || w < 1 || w > 7)) throw new Error('適用星期必須是 1（週一）到 7（週日）');
  if (weekdays.length === 0 && !body.includeNationalHolidays) throw new Error('請至少選擇一個適用的星期，或勾選國定假日');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('每天金額必須是大於 0 的整數');
  return [name, weekdays.sort((a, b) => a - b).join(','), !!body.includeNationalHolidays, amount, body.requireAttendance !== false, body.active !== false, body.notes || null];
}

const toRule = (r) => ({ ...r, weekdays: r.weekdays ? r.weekdays.split(',').map(Number) : [], includeNationalHolidays: !!r.includeNationalHolidays, requireAttendance: !!r.requireAttendance, active: !!r.active, amount: Number(r.amount) });

export async function listAllowanceRules(pool) {
  const [rows] = await pool.execute('SELECT * FROM shift_allowance_rules ORDER BY id');
  return rows.map(toRule);
}

export async function createAllowanceRule(pool, body) {
  const values = parseAllowanceRule(body);
  const [result] = await pool.execute(
    `INSERT INTO shift_allowance_rules (name, weekdays, includeNationalHolidays, amount, requireAttendance, active, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`, values);
  return result.insertId;
}

export async function updateAllowanceRule(pool, id, body) {
  const values = parseAllowanceRule(body);
  const [result] = await pool.execute(
    `UPDATE shift_allowance_rules SET name = ?, weekdays = ?, includeNationalHolidays = ?, amount = ?, requireAttendance = ?, active = ?, notes = ? WHERE id = ?`, [...values, id]);
  return result.affectedRows;
}

export async function deleteAllowanceRule(pool, id) {
  const [result] = await pool.execute('DELETE FROM shift_allowance_rules WHERE id = ?', [id]);
  return result.affectedRows;
}
