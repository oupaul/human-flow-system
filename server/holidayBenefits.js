// 節日福利提醒（開工紅包、端午禮金、中秋禮金等日期每年不固定、全公司同一天發放的福利）。
// 與年資福利不同：這是「全公司批次」，每條規則每年只有一筆紀錄（holiday_benefit_records），
// 提醒內容是「哪天發、目前在職幾人、預估總額」，只通知 HR／管理員。
//
// 日期來源：
//   holiday_name：比對 holidays 表（行事曆）的節日名稱關鍵字，取當年最早一天（避免「補假」干擾）
//   manual：由 HR 在畫面上為當年度手動建立一筆紀錄並填日期（如公司公告的開工日）
// 找不到日期（例如當年行事曆尚未匯入）時不會建立紀錄，等行事曆匯入後下次檢查自動補上。

import { sendNotification } from './notifications.js';

// 日期已過幾天內仍會補提醒
const CATCH_UP_DAYS = 7;

function addDays(ymd, days) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export async function checkHolidayBenefitReminders(pool) {
  const summary = { created: 0, notified: 0 };
  try {
    const [[{ today }]] = await pool.execute('SELECT CURDATE() AS today');
    const [rules] = await pool.execute('SELECT * FROM holiday_benefit_rules WHERE active = TRUE');
    if (rules.length === 0) return summary;

    const from = addDays(today, -CATCH_UP_DAYS);

    // 1) holiday_name 規則：從行事曆找當年（與跨年的下一年）最早的符合日期，尚無紀錄就建立
    for (const rule of rules) {
      if (rule.dateSource !== 'holiday_name' || !rule.holidayKeyword) continue;
      const [rows] = await pool.execute(
        `SELECT YEAR(date) AS year, MIN(date) AS eventDate FROM holidays
         WHERE isHoliday = TRUE AND name LIKE ? AND YEAR(date) BETWEEN YEAR(?) AND YEAR(?) + 1
         GROUP BY YEAR(date)`,
        [`%${rule.holidayKeyword}%`, today, today]
      );
      for (const { year, eventDate } of rows) {
        const to = addDays(today, rule.remindDaysBefore);
        if (eventDate < from || eventDate > to) continue;
        const [result] = await pool.execute(
          `INSERT IGNORE INTO holiday_benefit_records (ruleId, year, eventDate, status) VALUES (?, ?, ?, 'pending')`,
          [rule.id, year, eventDate]
        );
        summary.created += result.affectedRows;
      }
    }

    // 2) 所有「待提醒」紀錄（含 manual 規則由 HR 建立的）：日期落在提醒窗口內就通知
    const [pending] = await pool.execute(
      `SELECT r.id, r.eventDate, r.year, hr.name, hr.amount, hr.remindDaysBefore
       FROM holiday_benefit_records r JOIN holiday_benefit_rules hr ON r.ruleId = hr.id
       WHERE r.status = 'pending' AND hr.active = TRUE`
    );
    const due = pending.filter((r) => r.eventDate >= from && r.eventDate <= addDays(today, r.remindDaysBefore));
    if (due.length === 0) return summary;

    const [[{ headcount }]] = await pool.execute('SELECT COUNT(*) AS headcount FROM employees WHERE active = TRUE');
    const lines = [];
    for (const r of due) {
      const total = r.amount ? Number(r.amount) * headcount : null;
      await pool.execute(
        `UPDATE holiday_benefit_records SET status = 'notified', notifiedAt = NOW(), headcount = ?, estimatedTotal = ? WHERE id = ?`,
        [headcount, total, r.id]
      );
      const when = r.eventDate <= today ? `日期 ${r.eventDate} 已到` : `日期 ${r.eventDate}`;
      const money = r.amount
        ? `，每人 NT$ ${Number(r.amount).toLocaleString()}，預估總額 NT$ ${total.toLocaleString()}`
        : '';
      lines.push(`${r.year} 年「${r.name}」${when}，目前在職 ${headcount} 人${money}`);
    }
    await sendNotification(pool, '節日福利發放提醒', `以下節日福利即將或已到發放時間，請安排核發：\n${lines.join('\n')}`);
    summary.notified = due.length;
  } catch (error) {
    console.error('節日福利提醒檢查失敗（可能尚未套用 migration 012）：', error.message);
  }
  return summary;
}
