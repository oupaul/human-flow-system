// 人事成本：保險費率／級距表（CSV 匯入）與每月勞健退試算快照。
// 快照有兩種狀態：draft（草稿，可重新產生）與 locked（鎖定，凍結；只有 admin 能解除）。
// 試算使用「該月最後一天仍有效」的最新薪資紀錄，並且不處理當月到職／離職的按日折算（會在警告中提示）。

import * as XLSX from 'xlsx';
import { parseCsv } from './csv.js';
import { RATE_KEYS, BRACKET_TYPES, calculateItem, sumItems } from './insuranceCalc.js';

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
  'laborEmployee', 'laborEmployer', 'healthEmployee', 'healthEmployer', 'pensionEmployer', 'pensionEmployee'];

export class PayrollError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// 產生（或重新產生草稿）某月的試算快照。已鎖定的月份不能重新產生
export async function generateSnapshot(pool, month, username) {
  if (!isValidMonth(month)) throw new PayrollError(400, '月份格式不正確（需 YYYY-MM）');
  const currentMonth = new Date().toISOString().slice(0, 7);
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
    `SELECT employeeId, name, department, joinDate, terminationDate FROM employees
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

  const items = employees.map((e) => {
    const item = calculateItem(compByEmployee.get(e.employeeId) ?? null, rates, brackets);
    if (e.joinDate > start) item.warnings.push('當月到職，未依天數折算');
    if (e.terminationDate && e.terminationDate >= start && e.terminationDate < end) item.warnings.push('當月離職，未依天數折算');
    return { employeeId: e.employeeId, employeeName: e.name, department: e.department, ...item };
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let snapshotId = existing[0]?.id;
    const ratesUsed = JSON.stringify({ rates, effectiveDates: effective });
    if (snapshotId) {
      await connection.execute('DELETE FROM payroll_snapshot_items WHERE snapshotId = ?', [snapshotId]);
      await connection.execute(
        'UPDATE payroll_snapshots SET ratesUsed = ?, headcount = ?, generatedAt = NOW(), generatedBy = ? WHERE id = ?',
        [ratesUsed, items.length, username, snapshotId]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO payroll_snapshots (month, status, ratesUsed, headcount, generatedAt, generatedBy) VALUES (?, 'draft', ?, ?, NOW(), ?)`,
        [month, ratesUsed, items.length, username]
      );
      snapshotId = result.insertId;
    }
    if (items.length > 0) {
      await connection.query(
        `INSERT INTO payroll_snapshot_items (snapshotId, employeeId, employeeName, department, ${ITEM_COLUMNS.join(', ')}, warnings) VALUES ?`,
        [items.map((i) => [snapshotId, i.employeeId, i.employeeName, i.department, ...ITEM_COLUMNS.map((c) => i[c] ?? null), i.warnings.join('；') || null])]
      );
    }
    await connection.commit();
    return { month, headcount: items.length, warnings: items.filter((i) => i.warnings.length > 0).length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listSnapshots(pool) {
  const [rows] = await pool.execute(
    `SELECT s.*, COALESCE(SUM(i.monthlySalary), 0) AS salary,
       COALESCE(SUM(i.laborEmployee), 0) + COALESCE(SUM(i.healthEmployee), 0) + COALESCE(SUM(i.pensionEmployee), 0) AS employeeTotal,
       COALESCE(SUM(i.laborEmployer), 0) + COALESCE(SUM(i.healthEmployer), 0) + COALESCE(SUM(i.pensionEmployer), 0) AS employerTotal
     FROM payroll_snapshots s LEFT JOIN payroll_snapshot_items i ON i.snapshotId = s.id
     GROUP BY s.id ORDER BY s.month DESC`
  );
  return rows.map((r) => ({ ...r, totalCost: Number(r.salary) + Number(r.employerTotal) }));
}

export async function getSnapshot(pool, month) {
  const [snaps] = await pool.execute('SELECT * FROM payroll_snapshots WHERE month = ?', [month]);
  if (!snaps[0]) return null;
  const [items] = await pool.execute('SELECT * FROM payroll_snapshot_items WHERE snapshotId = ? ORDER BY employeeId', [snaps[0].id]);
  return { ...snaps[0], items, totals: sumItems(items.map((i) => ({ ...i }))) };
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

// 匯出 Excel：第一張表是明細，第二張是合計與使用的費率
export function snapshotToXlsx(snapshot) {
  const header = ['員工編號', '姓名', '部門', '月薪', '勞保投保薪資', '健保投保薪資', '勞退提繳工資', '自提率(%)', '健保眷屬',
    '勞保-員工', '勞保-公司', '健保-員工', '健保-公司', '勞退-公司', '勞退-員工自提', '員工自付合計', '公司負擔合計', '公司總成本', '警告'];
  const n = (v) => (v === null || v === undefined ? '' : Number(v));
  const rows = snapshot.items.map((i) => {
    const employee = Number(i.laborEmployee ?? 0) + Number(i.healthEmployee ?? 0) + Number(i.pensionEmployee ?? 0);
    const employer = Number(i.laborEmployer ?? 0) + Number(i.healthEmployer ?? 0) + Number(i.pensionEmployer ?? 0);
    return [i.employeeId, i.employeeName, i.department, n(i.monthlySalary), n(i.laborInsured), n(i.healthInsured), n(i.pensionWage),
      n(i.voluntaryPensionRate), n(i.healthDependents), n(i.laborEmployee), n(i.laborEmployer), n(i.healthEmployee), n(i.healthEmployer),
      n(i.pensionEmployer), n(i.pensionEmployee), employee, employer, Number(i.monthlySalary ?? 0) + employer, i.warnings || ''];
  });
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const summary = [
    ['月份', snapshot.month], ['狀態', snapshot.status === 'locked' ? '已鎖定' : '草稿'], ['人數', snapshot.headcount],
    ['月薪合計', snapshot.totals.salary], ['員工自付合計', snapshot.totals.employee],
    ['公司負擔合計', snapshot.totals.employer], ['公司總成本', snapshot.totals.totalCost], [],
    ['使用的費率（產生當下）'],
    ...Object.entries(JSON.parse(snapshot.ratesUsed || '{}').rates || {}).map(([k, v]) => [RATE_KEYS[k] || k, v]),
    [], ['注意：試算值僅供參考，實際金額以勞保局、健保署繳款單為準；當月到職／離職未依天數折算。'],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '明細');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), '合計與費率');
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
