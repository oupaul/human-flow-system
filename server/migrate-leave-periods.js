// 既有部署套用 server/migrations/001_leave_periods.sql（新增資料表結構）之後，
// 執行這支腳本幫「目前還沒有任何 leave_periods 紀錄」的在職員工，補建目前這期
// 的特休週年紀錄。已用天數會沿用 leave_balances 裡舊制累計的 annualLeaveUsed
// 當起點（無法精確還原歷史各期的休假紀錄，僅為最接近的估算）。
//
// 用法：npm run migrate:leave-periods

import 'dotenv/config';
import mysql from 'mysql2/promise';

function calculateAnnualLeaveDays(joinDate, asOfDate = new Date()) {
  const start = new Date(joinDate);
  const years = (asOfDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 0.5) return 0;
  if (years < 1) return 3;
  const fullYears = Math.floor(years);
  if (fullYears < 2) return 7;
  if (fullYears < 3) return 10;
  if (fullYears < 5) return 14;
  if (fullYears < 10) return 15;
  return Math.min(15 + (fullYears - 10), 30);
}

function addOneYear(dateStr) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function computePeriodGrant(joinDate, periodEnd) {
  const justBeforeEnd = new Date(new Date(periodEnd).getTime() - 24 * 60 * 60 * 1000);
  return calculateAnnualLeaveDays(joinDate, justBeforeEnd);
}

// 找出目前這位員工「正在進行中」的週年區間（依到職日逐年往前推算到今天所在的那一期）
function findCurrentPeriod(joinDate) {
  let periodStart = joinDate;
  let periodEnd = addOneYear(periodStart);
  const today = new Date().toISOString().slice(0, 10);
  while (periodEnd <= today) {
    periodStart = periodEnd;
    periodEnd = addOneYear(periodStart);
  }
  return { periodStart, periodEnd };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'hrms_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hrms_database',
  port: Number(process.env.DB_PORT) || 3306,
  dateStrings: true,
});

const [employees] = await pool.execute(`
  SELECT e.employeeId, e.joinDate, IFNULL(lb.annualLeaveUsed, 0) as legacyUsed
  FROM employees e
  LEFT JOIN leave_balances lb ON lb.employeeId = e.employeeId
  WHERE e.active = TRUE
`);

let created = 0;
let skipped = 0;

for (const employee of employees) {
  const [existing] = await pool.execute(
    'SELECT id FROM leave_periods WHERE employeeId = ?',
    [employee.employeeId]
  );
  if (existing.length > 0) {
    skipped += 1;
    continue;
  }

  const { periodStart, periodEnd } = findCurrentPeriod(employee.joinDate);
  const grantedDays = computePeriodGrant(employee.joinDate, periodEnd);
  const usedDays = Math.min(employee.legacyUsed, grantedDays);

  await pool.execute(
    'INSERT INTO leave_periods (employeeId, periodStart, periodEnd, grantedDays, carriedInDays, usedDays) VALUES (?, ?, ?, ?, 0, ?)',
    [employee.employeeId, periodStart, periodEnd, grantedDays, usedDays]
  );
  created += 1;
  console.log(`已建立 ${employee.employeeId} 目前週年期間：${periodStart} ~ ${periodEnd}，發放 ${grantedDays} 天，已用 ${usedDays} 天`);
}

console.log(`✅ 完成，新建 ${created} 筆，略過（已存在）${skipped} 筆`);
await pool.end();
