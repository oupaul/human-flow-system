// 特休週年結算提醒：只通知 HR/管理員「誰的特休週年快到／已到、還沒結算」，
// 不會自動結算——遞延或折現的決定與金額一律由 HR 在「假別管理 → 特休結算」確認。
//
// 兩種通知：
//   即將到期：週年日前 SETTLEMENT_REMIND_DAYS_BEFORE 天內，每期只通知一次
//             （用 leave_periods.settlementRemindedAt 防重複；伺服器漏跑幾天也不會漏）
//   已逾期未結算：週年日已到（含已過）仍未結算的，每週一彙整通知一次，直到結算為止

import { sendNotification } from './notifications.js';

// 週年日前幾天開始通知，留時間給 HR 先跟員工確認休假與遞延意願
const SETTLEMENT_REMIND_DAYS_BEFORE = 30;

// 依「遞延進來的天數優先使用」試算週年結算時：強制折現天數（遞延已逾期未休）
// 與可選遞延天數（本期新發放、還沒到期，可選擇遞延或折現）
export function computeSettlementSplit(period) {
  const usedFromCarriedIn = Math.min(period.usedDays, period.carriedInDays);
  const usedFromGrant = period.usedDays - usedFromCarriedIn;
  const mandatoryCashOutDays = period.carriedInDays - usedFromCarriedIn;
  const remainingGrantDays = Math.max(0, period.grantedDays - usedFromGrant);
  return { mandatoryCashOutDays, remainingGrantDays };
}

function describe(period) {
  const { mandatoryCashOutDays, remainingGrantDays } = computeSettlementSplit(period);
  const carried = period.carriedInDays > 0 ? `（含上期遞延 ${period.carriedInDays} 天）` : '';
  const mandatory = mandatoryCashOutDays > 0 ? `，上期遞延未休、須折現 ${mandatoryCashOutDays} 天` : '';
  return `${period.employee}（${period.employeeId}）週年日 ${period.periodEnd}：本期 ${period.grantedDays} 天${carried}，` +
    `已休 ${period.usedDays} 天，本期可遞延或折現 ${remainingGrantDays} 天${mandatory}`;
}

let lastOverdueDigestDate = null; // 同一程序同一天只彙整一次

export async function checkLeaveSettlementReminders(pool) {
  const summary = { upcoming: 0, overdue: 0 };
  try {
    const [[{ today }]] = await pool.execute('SELECT CURDATE() AS today');

    const [upcoming] = await pool.execute(
      `SELECT lp.*, e.name AS employee
       FROM leave_periods lp JOIN employees e ON lp.employeeId = e.employeeId
       WHERE lp.settledAt IS NULL AND e.active = TRUE AND lp.settlementRemindedAt IS NULL
         AND lp.periodEnd > CURDATE() AND lp.periodEnd <= CURDATE() + INTERVAL ? DAY
       ORDER BY lp.periodEnd`,
      [SETTLEMENT_REMIND_DAYS_BEFORE]
    );

    let overdue = [];
    const isMonday = new Date().getDay() === 1;
    if (isMonday && lastOverdueDigestDate !== today) {
      [overdue] = await pool.execute(
        `SELECT lp.*, e.name AS employee
         FROM leave_periods lp JOIN employees e ON lp.employeeId = e.employeeId
         WHERE lp.settledAt IS NULL AND e.active = TRUE AND lp.periodEnd <= CURDATE()
         ORDER BY lp.periodEnd`
      );
    }

    if (upcoming.length === 0 && overdue.length === 0) return summary;

    const sections = [];
    if (upcoming.length > 0) {
      sections.push(`【即將到週年日（${SETTLEMENT_REMIND_DAYS_BEFORE} 天內）】\n${upcoming.map(describe).join('\n')}`);
    }
    if (overdue.length > 0) {
      sections.push(`【已到週年日、尚未結算】\n${overdue.map(describe).join('\n')}`);
    }
    await sendNotification(
      pool,
      '特休週年結算提醒',
      `以下員工的特休週年需要結算，請至「假別管理 → 特休結算」確認遞延或折現（系統不會自動結算）：\n\n${sections.join('\n\n')}`
    );

    if (upcoming.length > 0) {
      await pool.query('UPDATE leave_periods SET settlementRemindedAt = NOW() WHERE id IN (?)', [upcoming.map((p) => p.id)]);
    }
    if (overdue.length > 0) lastOverdueDigestDate = today;
    summary.upcoming = upcoming.length;
    summary.overdue = overdue.length;
  } catch (error) {
    console.error('特休週年結算提醒檢查失敗（可能尚未套用 migration 013）：', error.message);
  }
  return summary;
}
