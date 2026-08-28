// 修復因 getOrCreateActivePeriod 舊版 bug 而建立錯誤的特休週年紀錄：
// 新增員工（尤其是到職日回填多年前的既有員工）時，週年區間一律被建立成
// 「到職日起算的第一年」，而不是「到職日往前推算到今天所在的那一期」，
// 導致發放天數用了剛到職那年的級距，而不是實際年資對應的天數。
//
// 這支腳本會找出所有尚未結算（settledAt IS NULL）的週年紀錄，重新計算
// 「今天」真正應該落在哪一期，如果跟目前存的不一樣就修正 periodStart/
// periodEnd/grantedDays（已用天數 usedDays 維持不動，不會被覆蓋）。
// 已經正確的紀錄執行這支腳本不會有任何變化，可以放心重複執行。
//
// 用法：npm run fix:leave-periods

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

function findCurrentPeriod(joinDate) {
  const today = new Date().toISOString().slice(0, 10);
  let periodStart = joinDate;
  let periodEnd = addOneYear(periodStart);
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

const [periods] = await pool.execute(`
  SELECT lp.id, lp.employeeId, lp.periodStart, lp.periodEnd, e.joinDate
  FROM leave_periods lp
  JOIN employees e ON lp.employeeId = e.employeeId
  WHERE lp.settledAt IS NULL
`);

let fixed = 0;

for (const period of periods) {
  const correct = findCurrentPeriod(period.joinDate);
  if (correct.periodStart === period.periodStart && correct.periodEnd === period.periodEnd) {
    continue;
  }

  const grantedDays = computePeriodGrant(period.joinDate, correct.periodEnd);
  await pool.execute(
    'UPDATE leave_periods SET periodStart = ?, periodEnd = ?, grantedDays = ? WHERE id = ?',
    [correct.periodStart, correct.periodEnd, grantedDays, period.id]
  );
  fixed += 1;
  console.log(
    `修正 ${period.employeeId}：${period.periodStart} ~ ${period.periodEnd} → ${correct.periodStart} ~ ${correct.periodEnd}，發放天數改為 ${grantedDays} 天`
  );
}

console.log(`✅ 完成，共修正 ${fixed} 筆（已用天數皆維持不變）`);
await pool.end();
