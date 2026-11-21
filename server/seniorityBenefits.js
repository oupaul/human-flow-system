// 年資福利提醒（旅遊補助、留任獎金等依年資觸發的福利）。
// 規則由 HR 在系統內設定（seniority_benefit_rules），每天排程比對在職員工的到職日，
// 資格日落在「今天 ~ 今天 + 提前提醒天數」內、且尚無紀錄的，就建立一筆紀錄
// （seniority_benefit_records，同時作為防重複提醒用）並通知 HR／管理員（不直接通知員工本人）。
// 以「有沒有紀錄」判斷而非「剛好某一天」，所以伺服器某天沒在跑、重啟多次都不會漏發或重發。

import { sendNotification } from './notifications.js';

// 資格日已過幾天內仍會補提醒（涵蓋伺服器停機、或規則剛建立當天剛好是資格日的情況）
const CATCH_UP_DAYS = 7;

const TYPE_LABELS = {
  travel_subsidy: '旅遊補助',
  retention_bonus: '留任獎金',
  other: '年資福利',
};

function parseYmd(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function formatYmd(date) {
  return date.toISOString().slice(0, 10);
}

// 到職日加上 n 年；2/29 到職者在非閏年落在 3/1
export function addYears(ymd, years) {
  const { y, m, d } = parseYmd(ymd);
  return formatYmd(new Date(Date.UTC(y + years, m - 1, d)));
}

function addDays(ymd, days) {
  const { y, m, d } = parseYmd(ymd);
  return formatYmd(new Date(Date.UTC(y, m - 1, d + days)));
}

// 列出落在 [from, to]（含）區間內的資格日。純函式，方便測試
export function eligibleDatesInWindow(joinDate, rule, from, to) {
  const dates = [];
  const step = rule.repeatEveryYears > 0 ? rule.repeatEveryYears : null;
  for (let years = rule.startYears; years < 200; years += step || 1) {
    const date = addYears(joinDate, years);
    if (date > to) break;
    if (date >= from) dates.push({ date, years });
    if (!step) break;
  }
  return dates;
}

// 資格日已到或已過用「已符合」，還沒到用「將於…符合」，避免措辭與實際狀態不符
function describe(rule, employee, eligibleDate, years, today) {
  const amount = rule.amount ? `，參考金額 NT$ ${Number(rule.amount).toLocaleString()}` : '';
  const timing = eligibleDate <= today
    ? `年資已滿 ${years} 年，已符合「${rule.name}」資格，資格日 ${eligibleDate}`
    : `年資將滿 ${years} 年，將於 ${eligibleDate} 符合「${rule.name}」資格`;
  return `${employee.name}（${employee.employeeId}，${employee.department}）${timing}${amount}`;
}

export async function checkSeniorityBenefitReminders(pool) {
  const summary = { created: 0, hrNotified: 0 };
  try {
    const [[{ today }]] = await pool.execute('SELECT CURDATE() AS today');
    const [rules] = await pool.execute('SELECT * FROM seniority_benefit_rules WHERE active = TRUE');
    if (rules.length === 0) return summary;

    const [employees] = await pool.execute(
      'SELECT employeeId, name, department, email, joinDate FROM employees WHERE active = TRUE AND joinDate IS NOT NULL'
    );

    const hrLines = [];
    for (const rule of rules) {
      const label = TYPE_LABELS[rule.type] || TYPE_LABELS.other;
      const from = addDays(today, -CATCH_UP_DAYS);
      const to = addDays(today, rule.remindDaysBefore);

      for (const employee of employees) {
        for (const { date, years } of eligibleDatesInWindow(employee.joinDate, rule, from, to)) {
          const [result] = await pool.execute(
            `INSERT IGNORE INTO seniority_benefit_records (ruleId, employeeId, eligibleDate, status)
             VALUES (?, ?, ?, 'pending')`,
            [rule.id, employee.employeeId, date]
          );
          if (result.affectedRows === 0) continue; // 已提醒過

          summary.created += 1;
          if (rule.notifyHr) hrLines.push(`[${label}] ${describe(rule, employee, date, years, today)}`);

          await pool.execute(
            `UPDATE seniority_benefit_records SET status = 'notified', notifiedAt = NOW() WHERE ruleId = ? AND employeeId = ? AND eligibleDate = ?`,
            [rule.id, employee.employeeId, date]
          );
        }
      }
    }

    if (hrLines.length > 0) {
      await sendNotification(pool, '年資福利資格提醒', `以下員工已符合或即將符合年資福利資格，請安排核發：\n${hrLines.join('\n')}`);
      summary.hrNotified = hrLines.length;
    }
  } catch (error) {
    console.error('年資福利提醒檢查失敗（可能尚未套用 migration 011）：', error.message);
  }
  return summary;
}
