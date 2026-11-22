// 假日行事曆自動同步：從臺北市政府資料開放平台下載「臺北市政府行政機關辦公日曆表」
// （https://data.taipei/dataset/detail?id=c30ca421-d935-4faa-b523-9c175c8de738），
// 內容與人事行政總處公告的全國辦公日曆一致，一年更新一次（通常 10 月前後會發布隔年資料）。
// 另外每天檢查「今年」與（10 月起）「明年」的行事曆是否已匯入：沒有就先嘗試自動同步，
// 還是沒有才通知 HR 手動處理，避免依行事曆日期運作的福利提醒（端午、中秋等）靜默失效。

import { sendNotification } from './notifications.js';

const TAIPEI_DATASET_ID = 'c30ca421-d935-4faa-b523-9c175c8de738';
const TAIPEI_BASE = 'https://data.taipei';
const FETCH_TIMEOUT_MS = 30_000;

// 一年有命名的放假日（紀念日、節日、補假…）通常十個以上；少於這個數視為「尚未匯入」
const MIN_NAMED_HOLIDAYS_PER_YEAR = 5;
// 提醒「明年」行事曆從幾月開始（政府約 10 月前後公告隔年資料）
const NEXT_YEAR_CHECK_FROM_MONTH = 10;

async function fetchWithTimeout(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} 回應 ${response.status}`);
  return response;
}

// 逐字元解析 CSV（處理引號與引號內的逗號、換行）
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

// 把辦公日曆表 CSV 轉成 holidays 表的列。
// 欄位：Date（YYYYMMDD）、name（節日名稱）、isHoliday（是／否）、holidayCategory、description。
// 一般週末沒有名稱（存 NULL）；補假、調整放假日、補行上班日沒有 name 時用類別當名稱，
// 讓前端列表看得出為什麼這天放假或補班
export function parseTaipeiCalendarCsv(csvText) {
  const rows = parseCsv(csvText.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('行事曆內容是空的');
  const header = rows[0].map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const idx = { date: col('Date'), name: col('name'), isHoliday: col('isHoliday'), category: col('holidayCategory') };
  if (idx.date === -1 || idx.isHoliday === -1) {
    throw new Error('行事曆欄位格式與預期不符（需要 Date、isHoliday 欄位），資料來源格式可能已變更');
  }

  const result = [];
  for (const cells of rows.slice(1)) {
    const digits = (cells[idx.date] || '').replace(/\D/g, '');
    if (digits.length !== 8) continue;
    const category = (cells[idx.category] || '').trim();
    const name = (cells[idx.name] || '').trim()
      || (category && !category.startsWith('星期') ? category : null);
    result.push({
      date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`,
      name,
      isHoliday: (cells[idx.isHoliday] || '').trim() === '是',
    });
  }
  return result;
}

// 下載最新行事曆並寫入 holidays 表。只寫入今年（含）以後的資料，避免改動歷史年度；
// 手動新增（source='manual'）的日期不會被覆蓋。回傳寫入筆數與涵蓋年度
export async function syncHolidaysFromTaipei(pool) {
  const meta = await (await fetchWithTimeout(
    `${TAIPEI_BASE}/api/frontstage/tpeod/dataset.view?id=${TAIPEI_DATASET_ID}`
  )).json();
  const resource = meta?.payload?.resources?.find((r) => r.file_format === 'CSV' || /csv/i.test(r.mimetype || ''));
  if (!resource?.url) throw new Error('資料集中找不到 CSV 檔案，資料來源結構可能已變更');

  const csv = await (await fetchWithTimeout(`${TAIPEI_BASE}${resource.url}`)).text();
  const fromYear = new Date().getFullYear();
  const rows = parseTaipeiCalendarCsv(csv).filter((r) => Number(r.date.slice(0, 4)) >= fromYear);
  if (rows.length === 0) throw new Error(`行事曆中沒有 ${fromYear} 年（含）以後的資料`);

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await pool.query(
      `INSERT INTO holidays (date, name, isHoliday, source) VALUES ?
       ON DUPLICATE KEY UPDATE
         name = IF(source = 'manual', name, VALUES(name)),
         isHoliday = IF(source = 'manual', isHoliday, VALUES(isHoliday)),
         source = IF(source = 'manual', source, VALUES(source))`,
      [chunk.map((r) => [r.date, r.name, r.isHoliday, 'taipei'])]
    );
  }
  const years = [...new Set(rows.map((r) => r.date.slice(0, 4)))];
  return { imported: rows.length, years };
}

async function hasCalendarForYear(pool, year) {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM holidays WHERE YEAR(date) = ? AND isHoliday = TRUE AND name IS NOT NULL AND name <> ''`,
    [year]
  );
  return count >= MIN_NAMED_HOLIDAYS_PER_YEAR;
}

let lastReminderDate = null; // 同一個程序內同一天只提醒一次（重啟不影響下面的「每週一」節奏）

// 每天執行：缺今年或（10 月起）明年的行事曆時，先自動同步，仍缺才通知 HR。
// 通知只在每週一發出，避免每天重複打擾；自動同步則每天都會再試一次
export async function checkHolidayCalendar(pool) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const years = [year];
    if (now.getMonth() + 1 >= NEXT_YEAR_CHECK_FROM_MONTH) years.push(year + 1);

    let missing = [];
    for (const y of years) if (!(await hasCalendarForYear(pool, y))) missing.push(y);
    if (missing.length === 0) return { missing: [] };

    let syncError = null;
    try {
      await syncHolidaysFromTaipei(pool);
    } catch (error) {
      syncError = error.message;
      console.error('[holidaySync] 自動同步行事曆失敗：', error.message);
    }
    const stillMissing = [];
    for (const y of missing) if (!(await hasCalendarForYear(pool, y))) stillMissing.push(y);
    missing = stillMissing;
    if (missing.length === 0) return { missing: [] };

    const today = now.toISOString().slice(0, 10);
    if (now.getDay() === 1 && lastReminderDate !== today) {
      lastReminderDate = today;
      const [rules] = await pool.execute(
        `SELECT name FROM holiday_benefit_rules WHERE active = TRUE AND dateSource = 'holiday_name'`
      ).catch(() => [[]]);
      const affected = rules.length > 0 ? `\n以下依行事曆日期提醒的節日福利將無法自動抓到日期：${rules.map((r) => r.name).join('、')}` : '';
      const reason = syncError ? `\n自動同步失敗原因：${syncError}` : '\n自動同步已執行，但資料來源尚未包含該年度。';
      await sendNotification(
        pool,
        '假日行事曆尚未匯入',
        `系統尚未匯入 ${missing.join('、')} 年的假日行事曆。請至「假別管理 → 國定假日」匯入，或稍後待資料來源更新後系統會再自動同步。${reason}${affected}`
      );
    }
    return { missing };
  } catch (error) {
    console.error('假日行事曆檢查失敗：', error.message);
    return { missing: [], error: error.message };
  }
}
