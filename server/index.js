import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { sendNotification, getNotificationSettings, sendTestNotification } from './notifications.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!JWT_SECRET) {
  console.error('❌ 缺少 JWT_SECRET 環境變數，請在 .env 中設定後再啟動伺服器（可參考 .env.example）');
  process.exit(1);
}

// 中介軟體
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
}));
app.use(express.json());

// 資料庫連接配置
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'hrms_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hrms_database',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // DATE/DATETIME 欄位回傳為 'YYYY-MM-DD' 字串，避免被序列化成帶時區的完整 ISO 時間，
  // 導致前端 <input type="date"> 無法正確顯示
  dateStrings: true,
  // TINYINT(1) 欄位（如 active、isPaid…）自動轉為 JS boolean，避免前端收到 0/1 數字；
  // DECIMAL 欄位（天數、金額）自動轉為 JS number，避免前端收到字串
  typeCast: (field, next) => {
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1';
    }
    if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
      const value = field.string();
      return value === null ? null : parseFloat(value);
    }
    return next();
  },
});

// 請假證明文件（如訃聞、診斷證明）上傳設定：存在容器內的 uploads 目錄，
// docker-compose 會掛一個獨立 volume 讓檔案不會隨容器重建而消失
// 以此檔案所在目錄為基準，不受執行時的工作目錄影響（Docker 內是 /app/uploads，
// 本機用 npm run server 執行時則是 server/uploads）；用 fileURLToPath 而非
// URL.pathname 是因為路徑含空白等字元時 .pathname 只會回傳未解碼的 %20
const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads', 'leave-attachments');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const uploadAttachment = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('僅允許上傳 JPG/PNG/WEBP 圖片或 PDF 檔案'));
    }
  },
});

// 考勤／請假紀錄匯入檔只需要解析內容存進資料庫，不用留存原始檔案，用記憶體儲存即可
const uploadImportFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 依勞基法第 38 條計算特休天數（以到職日與基準日的年資試算）
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

// 建立或同步員工的登入帳號：登入帳號使用員工的 email，employee_id 綁定員工編號，
// 密碼預設為員工編號。resetPassword=true 時會將既有帳號的密碼重設為預設值
async function syncEmployeeAccount(employeeId, email, { resetPassword = false } = {}) {
  const [existingRows] = await pool.execute('SELECT id FROM users WHERE employee_id = ?', [employeeId]);

  if (existingRows.length === 0) {
    const passwordHash = await bcrypt.hash(employeeId, 10);
    await pool.execute(
      `INSERT INTO users (username, password_hash, role, employee_id, active) VALUES (?, ?, 'employee', ?, TRUE)`,
      [email, passwordHash, employeeId]
    );
    return;
  }

  if (resetPassword) {
    const passwordHash = await bcrypt.hash(employeeId, 10);
    await pool.execute(
      'UPDATE users SET username = ?, password_hash = ?, active = TRUE WHERE employee_id = ?',
      [email, passwordHash, employeeId]
    );
  } else {
    await pool.execute('UPDATE users SET username = ? WHERE employee_id = ?', [email, employeeId]);
  }
}

function addOneYear(dateStr) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// 依勞基法第 32-1 條，補休時數以「勞工工作之時數」計算，即加班 1 小時換
// 補休 1 小時（1:1），這是法定最低標準，不套用加班費的加成倍率；雇主如願
// 從優（例如比照加班費倍率）給予補休，屬於勞雇雙方另外約定的範圍
function calculateCompHours(hours) {
  return Math.round(hours * 10) / 10;
}

// 中午午休時段固定為 12:00–13:00（如貴公司午休時間不同，請修改這兩個常數）
const LUNCH_BREAK_START_MINUTES = 12 * 60;
const LUNCH_BREAK_END_MINUTES = 13 * 60;

// 計算同一天內 startTime~endTime 的實際工時，自動扣除與中午午休時段重疊的部分；
// 用於加班申請時數與補休請假時數的計算，避免時段橫跨午休時把午休也算成工時/請假
function calculateWorkingHours(startTime, endTime) {
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  const totalMinutes = endMinutes - startMinutes;
  const overlapStart = Math.max(startMinutes, LUNCH_BREAK_START_MINUTES);
  const overlapEnd = Math.min(endMinutes, LUNCH_BREAK_END_MINUTES);
  const lunchOverlapMinutes = Math.max(0, overlapEnd - overlapStart);
  return (totalMinutes - lunchOverlapMinutes) / 60;
}

// 依到期日由近到遠依序扣抵補休額度；額度不足會丟出錯誤，呼叫端需在此之前
// 就先檢查總剩餘時數，避免扣到一半才失敗造成資料不一致
async function allocateCompHours(pool, employeeId, hours, leaveApplicationId) {
  const [grants] = await pool.execute(
    `SELECT id, hours, usedHours FROM comp_time_grants
     WHERE employeeId = ? AND settledAt IS NULL AND deadline >= CURDATE() AND hours > usedHours
     ORDER BY deadline ASC, id ASC`,
    [employeeId]
  );
  let remaining = hours;
  for (const grant of grants) {
    if (remaining <= 0.001) break;
    const available = grant.hours - grant.usedHours;
    const take = Math.min(available, remaining);
    if (take <= 0) continue;
    await pool.execute('UPDATE comp_time_grants SET usedHours = usedHours + ? WHERE id = ?', [take, grant.id]);
    await pool.execute('INSERT INTO comp_time_usages (grantId, leaveApplicationId, hours) VALUES (?, ?, ?)', [grant.id, leaveApplicationId, take]);
    remaining -= take;
  }
  if (remaining > 0.001) {
    throw new Error('INSUFFICIENT_COMP_HOURS');
  }
}

async function releaseCompHours(pool, leaveApplicationId) {
  const [usages] = await pool.execute('SELECT id, grantId, hours FROM comp_time_usages WHERE leaveApplicationId = ?', [leaveApplicationId]);
  for (const usage of usages) {
    await pool.execute('UPDATE comp_time_grants SET usedHours = GREATEST(0, usedHours - ?) WHERE id = ?', [usage.hours, usage.grantId]);
  }
  await pool.execute('DELETE FROM comp_time_usages WHERE leaveApplicationId = ?', [leaveApplicationId]);
}

// 計算某個特休週年期間應發放的天數：以該期間結束前一刻的年資判定，
// 這樣第一年到職滿 6 個月時自然會對應到 3 天、滿 1 年對應到 7 天…以此類推
function computePeriodGrant(joinDate, periodEnd) {
  const justBeforeEnd = new Date(new Date(periodEnd).getTime() - 24 * 60 * 60 * 1000);
  return calculateAnnualLeaveDays(joinDate, justBeforeEnd);
}

// 從到職日逐年往前推算，找出「今天」所落在的那一個特休週年區間。
// 用於新增員工時：不管到職日是今天還是很多年前，都會直接對應到目前
// 這一期，而不是每次都從到職日起算的第一年開始
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

// 取得員工目前尚未結算的特休週年期間；若不存在（新員工）則建立第一期
// initialUsedDays 僅在建立第一期時使用，讓系統上線時導入既有員工可登記
// 該員工在此之前已經休掉的天數，避免顯示成完全沒用過
async function getOrCreateActivePeriod(employeeId, joinDate, initialUsedDays = 0) {
  const [rows] = await pool.execute(
    'SELECT * FROM leave_periods WHERE employeeId = ? AND settledAt IS NULL ORDER BY periodStart DESC LIMIT 1',
    [employeeId]
  );
  if (rows[0]) {
    return rows[0];
  }

  const { periodStart, periodEnd } = findCurrentPeriod(joinDate);
  const grantedDays = computePeriodGrant(joinDate, periodEnd);

  const [result] = await pool.execute(
    'INSERT INTO leave_periods (employeeId, periodStart, periodEnd, grantedDays, carriedInDays, usedDays) VALUES (?, ?, ?, ?, 0, ?)',
    [employeeId, periodStart, periodEnd, grantedDays, initialUsedDays || 0]
  );
  const [newRows] = await pool.execute('SELECT * FROM leave_periods WHERE id = ?', [result.insertId]);
  return newRows[0];
}

// 新增一位員工：建立員工紀錄、第一期特休週年紀錄、假別餘額預設值、登入帳號。
// 供單筆新增（POST /employees）與批次匯入（POST /employees/import）共用
async function createEmployeeRecord(data) {
  const { name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary, gender, attendanceAccount, initialAnnualLeaveUsed } = data;
  if (!name || !employeeId || !department || !position || !email || !joinDate) {
    throw new Error('所有必填欄位皆需填寫（姓名、員工編號、部門、職位、電子郵件、到職日）');
  }

  const [result] = await pool.execute(
    'INSERT INTO employees (name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary, gender, attendanceAccount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, employeeId, department, position, email, phone || null, joinDate, active !== undefined ? active : true, address || null, notes || null, monthlySalary || null, gender || null, attendanceAccount || null]
  );

  await getOrCreateActivePeriod(employeeId, joinDate, Number(initialAnnualLeaveUsed) || 0);
  await pool.execute('INSERT INTO leave_balances (employeeId) VALUES (?)', [employeeId]);
  await syncEmployeeAccount(employeeId, email);

  const [newEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [result.insertId]);
  return newEmployee[0];
}

// 解析批次匯入員工的 CSV：欄位以標題關鍵字辨識，允許欄位順序調整、只填必要欄位
function parseEmployeeCsv(csvText) {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const splitRow = (line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const header = splitRow(lines[0]);
  const findColumn = (keywords) => header.findIndex((col) => keywords.some((keyword) => col.includes(keyword)));

  const columns = {
    name: findColumn(['姓名']),
    employeeId: findColumn(['員工編號', '編號']),
    department: findColumn(['部門']),
    position: findColumn(['職位']),
    email: findColumn(['電子郵件', 'Email', 'email']),
    phone: findColumn(['電話']),
    joinDate: findColumn(['到職日']),
    address: findColumn(['地址']),
    notes: findColumn(['備註']),
    monthlySalary: findColumn(['月薪']),
    gender: findColumn(['性別']),
    attendanceAccount: findColumn(['考勤帳號', '打卡帳號']),
    initialAnnualLeaveUsed: findColumn(['已用特休', '特休已用']),
  };

  if (columns.name === -1 || columns.employeeId === -1 || columns.department === -1 ||
      columns.position === -1 || columns.email === -1 || columns.joinDate === -1) {
    throw new Error('CSV 標題列需包含：姓名、員工編號、部門、職位、電子郵件、到職日');
  }

  const normalizeDate = (raw) => (raw ? raw.replace(/\//g, '-') : '');
  const pick = (cells, key) => (columns[key] === -1 ? '' : (cells[columns[key]] || ''));
  const normalizeGender = (raw) => {
    const value = (raw || '').trim().toLowerCase();
    if (['男', 'm', 'male'].includes(value)) return 'male';
    if (['女', 'f', 'female'].includes(value)) return 'female';
    return null;
  };

  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    return {
      name: pick(cells, 'name'),
      employeeId: pick(cells, 'employeeId'),
      department: pick(cells, 'department'),
      position: pick(cells, 'position'),
      email: pick(cells, 'email'),
      phone: pick(cells, 'phone') || null,
      joinDate: normalizeDate(pick(cells, 'joinDate')),
      address: pick(cells, 'address') || null,
      notes: pick(cells, 'notes') || null,
      monthlySalary: pick(cells, 'monthlySalary') || null,
      gender: normalizeGender(pick(cells, 'gender')),
      attendanceAccount: pick(cells, 'attendanceAccount') || null,
      initialAnnualLeaveUsed: pick(cells, 'initialAnnualLeaveUsed') || 0,
    };
  });
}

// 依「遞延進來的天數優先使用」試算週年結算時：強制折現天數（遞延已逾期未休）
// 與可選遞延天數（本期新發放、還沒到期，可選擇遞延或折現）
function computeSettlementSplit(period) {
  const usedFromCarriedIn = Math.min(period.usedDays, period.carriedInDays);
  const usedFromGrant = period.usedDays - usedFromCarriedIn;
  const mandatoryCashOutDays = period.carriedInDays - usedFromCarriedIn;
  const remainingGrantDays = Math.max(0, period.grantedDays - usedFromGrant);
  return { mandatoryCashOutDays, remainingGrantDays };
}

// 遲到/早退的容許誤差（分鐘），如需調整請直接改這個常數
const ATTENDANCE_GRACE_MINUTES = 10;

const ATTENDANCE_LEAVE_LABELS = new Set(['特休', '事假', '病假', '生理假', '婚假', '公假', '喪假', '補休']);
const ATTENDANCE_DAY_OFF_LABELS = new Set(['休息日', '例假日']);

// 解析外部打卡系統匯出的考勤 .xls：每人每天佔「簽到/簽退」兩欄，橫向排一整個月。
// 檔案裡的日期標題（如「07-01」）沒有年份，由呼叫端指定要匯入的西元年。
// 同一人可能因排班設定重複出現多列（例如日班/夜班），逐日挑選當天實際有資料的那一列
function parseAttendanceXls(buffer, year) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (rows.length < 3) {
    throw new Error('考勤檔案格式不正確，找不到資料列');
  }

  const headerRow = rows[0];
  const dayColumns = [];
  for (let col = 4; col < headerRow.length; col += 2) {
    const label = String(headerRow[col] || '').trim();
    const match = label.match(/^(\d{1,2})-(\d{1,2})/);
    if (!match) continue;
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    dayColumns.push({ col, date: `${year}-${month}-${day}` });
  }
  if (dayColumns.length === 0) {
    throw new Error('無法辨識日期欄位，請確認檔案格式（標題列需包含如「07-01」的日期）');
  }

  const byAccount = new Map();
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const account = String(row[1] || '').trim();
    if (!account) continue;
    const shiftLabel = String(row[3] || '').trim();
    if (!byAccount.has(account)) byAccount.set(account, []);
    byAccount.get(account).push({ shiftLabel, row });
  }

  const isTime = (value) => /^\d{1,2}:\d{2}$/.test(value);
  const parseShift = (label) => {
    const match = label.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    return match ? { start: match[1], end: match[2] } : { start: null, end: null };
  };

  const records = [];
  for (const [account, entries] of byAccount) {
    for (const { col, date } of dayColumns) {
      // 多列都缺卡時要保留「第一列」（該員工實際的排班列），不能被後面同樣缺卡
      // 的列覆蓋掉；只有遇到「非缺卡」的列才代表找到真正有效的資料，直接採用並停止
      let chosen = null;
      for (const entry of entries) {
        const inCell = String(entry.row[col] || '').trim();
        const outCell = String(entry.row[col + 1] || '').trim();
        if (!inCell && !outCell) continue;
        const isMissingBoth = inCell === '缺卡' && outCell === '缺卡';
        if (!chosen) {
          chosen = { entry, inCell, outCell };
        } else if (!isMissingBoth) {
          chosen = { entry, inCell, outCell };
          break;
        }
      }
      if (!chosen) continue;

      const { entry, inCell, outCell } = chosen;
      const { start: shiftStart, end: shiftEnd } = parseShift(entry.shiftLabel);

      let status = 'leave';
      let clockIn = null;
      let clockOut = null;
      let note = null;

      if (ATTENDANCE_DAY_OFF_LABELS.has(inCell)) {
        status = 'day_off';
        note = inCell;
      } else if (ATTENDANCE_LEAVE_LABELS.has(inCell)) {
        status = 'leave';
        note = inCell;
      } else if (isTime(inCell) && isTime(outCell)) {
        status = 'normal';
        clockIn = inCell;
        clockOut = outCell;
      } else if (isTime(inCell) || isTime(outCell)) {
        // 只有簽到或只有簽退：漏打卡，仍記錄有的那一筆時間供人工核對
        status = 'missing';
        clockIn = isTime(inCell) ? inCell : null;
        clockOut = isTime(outCell) ? outCell : null;
      } else if (inCell === '缺卡') {
        status = 'missing';
      } else {
        note = inCell || outCell || null;
      }

      records.push({ account, date, shiftStart, shiftEnd, clockIn, clockOut, status, note });
    }
  }

  return records;
}

// 解析外部打卡系統匯出的「請假紀錄」.xls：一列一筆請假紀錄，標題以關鍵字辨識，
// 欄位順序調整不影響解析。天數/時數/分鐘視該公司請假單位習慣，三者可能只填其中之一
function parseLeaveXls(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (rows.length < 2) {
    throw new Error('請假紀錄檔案格式不正確，找不到資料列');
  }

  const header = rows[0].map((cell) => String(cell || '').trim());
  const findColumn = (keywords) => header.findIndex((col) => keywords.some((keyword) => col.includes(keyword)));
  const columns = {
    account: findColumn(['人員帳號']),
    name: findColumn(['人員姓名']),
    leaveType: findColumn(['假別']),
    startDateTime: findColumn(['請假開始時間']),
    endDateTime: findColumn(['請假結束時間']),
    days: findColumn(['請假天數']),
    hours: findColumn(['請假時數']),
    minutes: findColumn(['請假分鐘數']),
    status: findColumn(['狀態']),
    reason: findColumn(['請假原因']),
  };
  if (columns.account === -1 || columns.leaveType === -1 || columns.startDateTime === -1 || columns.endDateTime === -1) {
    throw new Error('請假紀錄檔案標題列需包含：人員帳號、假別、請假開始時間、請假結束時間');
  }

  // 匯出檔的時間是「YYYY/MM/DD HH:MM:SS」字串，用正則手動解析成 MySQL DATETIME
  // 格式，避免用 new Date() 解讀成當地時區造成時間偏移
  const toDateTime = (raw) => {
    const value = String(raw || '').trim();
    const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return null;
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
    const pad = (n) => String(n).padStart(2, '0');
    return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
  };
  const toNumber = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  };
  const pick = (cells, key) => (columns[key] === -1 ? '' : String(cells[columns[key]] || '').trim());

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const account = pick(cells, 'account');
    const leaveType = pick(cells, 'leaveType');
    const startDateTime = toDateTime(cells[columns.startDateTime]);
    const endDateTime = toDateTime(cells[columns.endDateTime]);
    if (!account || !leaveType || !startDateTime || !endDateTime) continue;
    records.push({
      account,
      name: pick(cells, 'name') || null,
      leaveType,
      startDateTime,
      endDateTime,
      days: toNumber(pick(cells, 'days')),
      hours: toNumber(pick(cells, 'hours')),
      minutes: toNumber(pick(cells, 'minutes')),
      status: pick(cells, 'status') || null,
      reason: pick(cells, 'reason') || null,
    });
  }
  return records;
}

// 解析政府行政機關辦公日曆表（人事行政總處開放資料）CSV，格式彈性辨識欄位
function parseHolidayCsv(csvText) {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const splitRow = (line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const header = splitRow(lines[0]);

  const findColumn = (keywords) =>
    header.findIndex((col) => keywords.some((keyword) => col.includes(keyword)));

  const dateIdx = findColumn(['西元日期', '日期']);
  const isHolidayIdx = findColumn(['是否放假', '放假']);
  const nameIdx = findColumn(['備註', '名稱', '說明']);

  if (dateIdx === -1) {
    throw new Error('無法辨識日期欄位，請確認 CSV 是否為人事行政總處標準格式（需包含「西元日期」欄位）');
  }

  const normalizeDate = (raw) => {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly.length !== 8) return null;
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`;
  };

  const holidayValues = new Set(['是', '2', 'true', 'TRUE', '1']);

  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const date = normalizeDate(cells[dateIdx] || '');
    const isHoliday = isHolidayIdx === -1 ? true : holidayValues.has(cells[isHolidayIdx]);
    const name = nameIdx === -1 ? null : (cells[nameIdx] || null);
    return { date, isHoliday, name };
  }).filter((row) => row.date);
}

// 健康檢查端點（公開）
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date(),
    message: 'HRMS API Server is running',
  });
});

// 登入端點（公開）
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '請輸入帳號與密碼' });
    }

    const [rows] = await pool.execute(
      `SELECT u.*, e.name as employeeName, e.gender FROM users u
       LEFT JOIN employees e ON u.employee_id = e.employeeId
       WHERE u.username = ? AND u.active = TRUE`,
      [username]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, employeeId: user.employee_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        employeeId: user.employee_id,
        employeeName: user.employeeName || null,
        gender: user.gender || null,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: '登入失敗', detail: error.message });
  }
});

// Microsoft 365（Entra ID）單一登入設定；四個環境變數都設定齊全才會啟用，
// 未設定時登入頁不會顯示「使用 Microsoft 帳號登入」按鈕（見 /auth/microsoft/status）
const MS_TENANT_ID = process.env.MS_TENANT_ID;
const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI;
const MS_SSO_ENABLED = Boolean(MS_TENANT_ID && MS_CLIENT_ID && MS_CLIENT_SECRET && MS_REDIRECT_URI);
const FRONTEND_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

app.get('/api/auth/microsoft/status', (req, res) => {
  res.json({ enabled: MS_SSO_ENABLED });
});

// 導向 Microsoft 登入頁；用短效簽章 JWT 當 state 防 CSRF，不需要伺服器端 session 儲存。
// authorize URL 是租戶專屬（/{tenantId}/...），只有貴公司 M365 租戶內的帳號能登入，
// 其他租戶或個人 Microsoft 帳號在 Microsoft 自家登入頁就會被擋下
app.get('/api/auth/microsoft/login', (req, res) => {
  if (!MS_SSO_ENABLED) {
    return res.status(503).json({ error: '尚未設定 Microsoft 365 單一登入，請聯繫系統管理員' });
  }
  const state = jwt.sign({ purpose: 'ms-sso-state' }, JWT_SECRET, { expiresIn: '10m' });
  const authorizeUrl = new URL(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set('client_id', MS_CLIENT_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', MS_REDIRECT_URI);
  authorizeUrl.searchParams.set('response_mode', 'query');
  authorizeUrl.searchParams.set('scope', 'openid profile email User.Read');
  authorizeUrl.searchParams.set('state', state);
  res.redirect(authorizeUrl.toString());
});

// Microsoft 登入完成後導回這裡。用 access token 呼叫 Microsoft Graph /me 取得信箱，
// 不自行解析/驗證 id_token 簽章——換 token 與查 /me 都是伺服器對伺服器直接跟
// Microsoft 走 TLS，通道本身可信，沒有必要另外實作 JWKS 驗簽
app.get('/api/auth/microsoft/callback', async (req, res) => {
  const redirectWithError = (code) => res.redirect(`${FRONTEND_ORIGIN}/login?ssoError=${code}`);

  if (!MS_SSO_ENABLED) {
    return redirectWithError('not_configured');
  }

  const { code, state, error: msError } = req.query;
  if (msError) {
    console.error('Microsoft SSO error:', msError, req.query.error_description);
    return redirectWithError('microsoft_error');
  }
  if (!code || !state) {
    return redirectWithError('invalid_request');
  }

  try {
    jwt.verify(state, JWT_SECRET);
  } catch (error) {
    console.error('Invalid Microsoft SSO state:', error);
    return redirectWithError('invalid_state');
  }

  try {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        code,
        redirect_uri: MS_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Microsoft token exchange failed:', tokenData);
      return redirectWithError('token_exchange_failed');
    }

    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) {
      console.error('Microsoft Graph /me failed:', profile);
      return redirectWithError('profile_fetch_failed');
    }

    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
    if (!email) {
      return redirectWithError('no_email');
    }

    // 帳號比對邏輯與一般登入完全相同：username 就是員工的電子郵件
    const [rows] = await pool.execute(
      'SELECT id, username, role, employee_id FROM users WHERE LOWER(username) = ? AND active = TRUE',
      [email]
    );
    const user = rows[0];
    if (!user) {
      return redirectWithError('no_account');
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, employeeId: user.employee_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // token 放在網址 fragment（#）不是 query string，瀏覽器不會把 fragment 送給伺服器，
    // 也不會出現在 Referer header 或伺服器存取紀錄裡；前端 /sso-callback 頁面讀出來後
    // 呼叫既有的 GET /auth/me 補齊完整使用者資料，不在這裡重複組裝
    res.redirect(`${FRONTEND_ORIGIN}/sso-callback#token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Error during Microsoft SSO callback:', error);
    return redirectWithError('server_error');
  }
});

// 驗證 JWT 的中介軟體
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: '未登入或憑證無效' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }
}

// admin/hr/manager 三種角色視為「人資/主管」，可管理全公司資料；
// employee 角色僅能存取與自己相關的資料（由各路由自行過濾／覆寫 employeeId）
const STAFF_ROLES = ['admin', 'hr', 'manager'];

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '權限不足' });
    }
    next();
  };
}

// 以下路由皆須登入
const api = express.Router();
api.use(authMiddleware);

api.get('/auth/me', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.role, u.employee_id, e.name as employeeName, e.gender
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.employeeId
       WHERE u.id = ?`,
      [req.user.sub]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: '帳號不存在' });
    }
    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        employeeId: user.employee_id,
        employeeName: user.employeeName || null,
        gender: user.gender || null,
      },
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: '獲取使用者資料失敗', detail: error.message });
  }
});

// 任何登入者皆可自行修改密碼（需先驗證目前密碼）
api.put('/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '請輸入目前密碼與新密碼' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: '新密碼長度至少 4 碼' });
    }

    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.sub]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: '帳號不存在' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: '目前密碼不正確' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.sub]);

    res.json({ message: '密碼已更新' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: '修改密碼失敗', detail: error.message });
  }
});

// 系統設定 API 路由（僅 admin，內含 SMTP 密碼/OAuth 密鑰等敏感資訊）

// 回傳目前的通知設定；密碼/密鑰類欄位不直接回傳明文，只回傳「是否已設定」，
// 前端留空送出代表「維持原值不變」，非空字串才會覆蓋
api.get('/settings/notifications', requireRole('admin'), async (req, res) => {
  try {
    const settings = await getNotificationSettings(pool);
    res.json({
      channel: settings.channel,
      smtpHost: settings.smtp_host,
      smtpPort: settings.smtp_port,
      smtpSecure: settings.smtp_secure,
      smtpFrom: settings.smtp_from,
      notificationToEmails: settings.notification_to_emails,
      smtpAuthMethod: settings.smtp_auth_method,
      smtpUser: settings.smtp_user,
      smtpOauthUser: settings.smtp_oauth_user,
      smtpOauthClientId: settings.smtp_oauth_client_id,
      hasSmtpPassword: !!settings.smtp_password,
      hasSmtpOauthClientSecret: !!settings.smtp_oauth_client_secret,
      hasSmtpOauthRefreshToken: !!settings.smtp_oauth_refresh_token,
      hasTeamsWebhookUrl: !!settings.teams_webhook_url,
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: '獲取通知設定失敗', detail: error.message });
  }
});

api.put('/settings/notifications', requireRole('admin'), async (req, res) => {
  try {
    const current = await getNotificationSettings(pool);
    const body = req.body;
    const keep = (newValue, oldValue) => (newValue ? newValue : oldValue);

    await pool.execute(
      `UPDATE notification_settings SET
        channel = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_from = ?,
        notification_to_emails = ?, smtp_auth_method = ?, smtp_user = ?, smtp_password = ?,
        smtp_oauth_user = ?, smtp_oauth_client_id = ?, smtp_oauth_client_secret = ?,
        smtp_oauth_refresh_token = ?, teams_webhook_url = ?
       WHERE id = 1`,
      [
        body.channel || 'none',
        body.smtpHost || null,
        body.smtpPort ? Number(body.smtpPort) : null,
        !!body.smtpSecure,
        body.smtpFrom || null,
        body.notificationToEmails || null,
        body.smtpAuthMethod || 'basic',
        body.smtpUser || null,
        keep(body.smtpPassword, current.smtp_password),
        body.smtpOauthUser || null,
        body.smtpOauthClientId || null,
        keep(body.smtpOauthClientSecret, current.smtp_oauth_client_secret),
        keep(body.smtpOauthRefreshToken, current.smtp_oauth_refresh_token),
        keep(body.teamsWebhookUrl, current.teams_webhook_url),
      ]
    );

    res.json({ message: '通知設定已儲存' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: '儲存通知設定失敗', detail: error.message });
  }
});

api.post('/settings/notifications/test', requireRole('admin'), async (req, res) => {
  try {
    await sendTestNotification(pool);
    res.json({ message: '測試通知已送出，請確認是否收到' });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(400).json({ error: '測試通知發送失敗', detail: error.message });
  }
});

// 部門 API 路由（僅 HR/主管可管理）

api.get('/departments', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    // employeeCount 即時從 employees 表計算在職人數，不使用 departments 表裡從未被維護過的靜態欄位
    const [rows] = await pool.execute(`
      SELECT
        d.id, d.name, d.leadName, d.parentId, d.description, d.created_at, d.updated_at,
        parent.name as parentName,
        IFNULL(emp_counts.count, 0) as employeeCount
      FROM departments d
      LEFT JOIN departments parent ON d.parentId = parent.id
      LEFT JOIN (
        SELECT department, COUNT(*) as count FROM employees WHERE active = TRUE GROUP BY department
      ) emp_counts ON emp_counts.department = d.name
      ORDER BY d.parentId IS NULL DESC, d.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: '獲取部門資料失敗', detail: error.message });
  }
});

api.post('/departments', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { name, leadName, parentId, description } = req.body;
    if (!name || !leadName) {
      return res.status(400).json({ error: '部門名稱與主管名稱為必填' });
    }
    const [result] = await pool.execute(
      'INSERT INTO departments (name, leadName, parentId, description, employeeCount) VALUES (?, ?, ?, ?, 0)',
      [name, leadName, parentId || null, description || null]
    );
    const [newDept] = await pool.execute('SELECT * FROM departments WHERE id = ?', [result.insertId]);
    res.json(newDept[0]);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: '新增部門失敗', detail: error.message });
  }
});

api.put('/departments/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, leadName, parentId, description } = req.body;

    // 員工的部門欄位是用名稱比對（不是外鍵），改名前先記下舊名稱，
    // 改名後要一併更新所有原本歸屬此部門的員工，否則他們會跟部門表脫鉤
    const [beforeRows] = await pool.execute('SELECT name FROM departments WHERE id = ?', [id]);
    const oldName = beforeRows[0]?.name;

    await pool.execute(
      'UPDATE departments SET name = ?, leadName = ?, parentId = ?, description = ? WHERE id = ?',
      [name, leadName, parentId || null, description || '', id]
    );

    if (oldName && oldName !== name) {
      await pool.execute('UPDATE employees SET department = ? WHERE department = ?', [name, oldName]);
    }

    const [updatedDept] = await pool.execute('SELECT * FROM departments WHERE id = ?', [id]);
    res.json(updatedDept[0]);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: '更新部門失敗', detail: error.message });
  }
});

api.delete('/departments/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    res.json({ message: '部門刪除成功' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: '刪除部門失敗', detail: error.message });
  }
});

// 員工 API 路由（僅 HR/主管可管理；員工本人請至自助服務端點）

api.get('/employees', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM employees ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: '獲取員工資料失敗', detail: error.message });
  }
});

api.post('/employees', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const newEmployee = await createEmployeeRecord(req.body);
    res.json(newEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(error.message?.includes('必填') ? 400 : 500).json({ error: error.message || '新增員工失敗' });
  }
});

// 批次匯入員工：CSV 標題列需含姓名/員工編號/部門/職位/電子郵件/到職日，
// 電話/地址/備註/月薪/已用特休天數為選填。逐列處理，單列失敗不影響其他列
api.post('/employees/import', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) {
      return res.status(400).json({ error: '請提供 CSV 內容' });
    }

    const rows = parseEmployeeCsv(csv);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV 中沒有可匯入的員工資料' });
    }

    let created = 0;
    const failed = [];
    for (const [index, row] of rows.entries()) {
      try {
        await createEmployeeRecord(row);
        created += 1;
      } catch (rowError) {
        failed.push({ row: index + 2, employeeId: row.employeeId || '(空白)', error: rowError.message });
      }
    }

    res.json({ message: '匯入完成', created, failed });
  } catch (error) {
    console.error('Error importing employees:', error);
    res.status(400).json({ error: '批次匯入員工失敗', detail: error.message });
  }
});

api.put('/employees/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary, gender, attendanceAccount } = req.body;

    const [beforeRows] = await pool.execute('SELECT employeeId FROM employees WHERE id = ?', [id]);
    const previousEmployeeId = beforeRows[0]?.employeeId;

    await pool.execute(
      'UPDATE employees SET name = ?, employeeId = ?, department = ?, position = ?, email = ?, phone = ?, joinDate = ?, active = ?, address = ?, notes = ?, monthlySalary = ?, gender = ?, attendanceAccount = ? WHERE id = ?',
      [name, employeeId, department, position, email, phone, joinDate, active, address || '', notes || '', monthlySalary || null, gender || null, attendanceAccount || null, id]
    );

    // 同步登入帳號：email 異動時登入帳號一併更新
    if (previousEmployeeId) {
      await pool.execute(
        'UPDATE users SET username = ?, employee_id = ? WHERE employee_id = ?',
        [email, employeeId, previousEmployeeId]
      );
    }

    const [updatedEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: '更新員工失敗', detail: error.message });
  }
});

api.delete('/employees/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ message: '員工刪除成功' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: '刪除員工失敗', detail: error.message });
  }
});

api.put('/employees/:id/terminate', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { terminationDate, terminationReason } = req.body;

    await pool.execute(
      'UPDATE employees SET active = false, terminationDate = ?, terminationReason = ? WHERE id = ?',
      [terminationDate, terminationReason, id]
    );

    // 離職後停用其登入帳號
    const [employeeRows] = await pool.execute('SELECT employeeId FROM employees WHERE id = ?', [id]);
    if (employeeRows[0]) {
      await pool.execute('UPDATE users SET active = FALSE WHERE employee_id = ?', [employeeRows[0].employeeId]);
    }

    const [updatedEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error terminating employee:', error);
    res.status(500).json({ error: '員工離職失敗', detail: error.message });
  }
});

// 將員工改派到另一個部門；供部門管理頁「直接管理成員」使用，只更新部門欄位，
// 不影響員工的其他資料（不像一般 PUT /employees/:id 需要整包欄位）
api.put('/employees/:id/department', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { department } = req.body;
    if (!department) {
      return res.status(400).json({ error: '部門為必填' });
    }

    await pool.execute('UPDATE employees SET department = ? WHERE id = ?', [department, id]);

    const [updatedEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
    if (!updatedEmployee[0]) {
      return res.status(404).json({ error: '找不到該名員工' });
    }
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error updating employee department:', error);
    res.status(500).json({ error: '更新員工部門失敗', detail: error.message });
  }
});

// 重設員工登入密碼為預設值（＝員工編號）；若尚未有登入帳號則一併建立
api.post('/employees/:id/reset-password', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const [employeeRows] = await pool.execute('SELECT employeeId, email FROM employees WHERE id = ?', [id]);
    const employee = employeeRows[0];
    if (!employee) {
      return res.status(404).json({ error: '找不到員工資料' });
    }

    await syncEmployeeAccount(employee.employeeId, employee.email, { resetPassword: true });

    res.json({ message: '密碼已重設', username: employee.email, defaultPassword: employee.employeeId });
  } catch (error) {
    console.error('Error resetting employee password:', error);
    res.status(500).json({ error: '重設密碼失敗', detail: error.message });
  }
});

// 假別類型 API 路由

api.get('/leave-types', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM leave_types ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ error: '獲取假別類型失敗', detail: error.message });
  }
});

api.post('/leave-types', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit } = req.body;

    const [result] = await pool.execute(
      'INSERT INTO leave_types (name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit]
    );

    const [newLeaveType] = await pool.execute('SELECT * FROM leave_types WHERE id = ?', [result.insertId]);
    res.json(newLeaveType[0]);
  } catch (error) {
    console.error('Error creating leave type:', error);
    res.status(500).json({ error: '新增假別類型失敗', detail: error.message });
  }
});

// 假別核給 API 路由（僅 HR/主管）：用於喪假、婚假等「同一事由分次請假」的
// 假別，HR 審核員工提供的證明文件後直接核給總天數與應休畢期限

// employee 角色只能看自己的核給紀錄；HR/主管可看全公司或依 employeeId 篩選
api.get('/leave-grants', async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    const employeeId = isEmployee ? req.user.employeeId : req.query.employeeId;
    const params = [];
    let query = `
      SELECT lg.*, e.name as employee, lt.name as leaveTypeName
      FROM leave_grants lg
      LEFT JOIN employees e ON lg.employeeId = e.employeeId
      LEFT JOIN leave_types lt ON lg.leaveTypeId = lt.id
    `;
    if (employeeId) {
      query += ' WHERE lg.employeeId = ?';
      params.push(employeeId);
    }
    query += ' ORDER BY lg.created_at DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave grants:', error);
    res.status(500).json({ error: '獲取假別核給紀錄失敗', detail: error.message });
  }
});

api.post('/leave-grants', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { employeeId, leaveTypeId, totalDays, deadline, note } = req.body;
    if (!employeeId || !leaveTypeId || !totalDays) {
      return res.status(400).json({ error: '員工、假別與核給天數為必填' });
    }

    const [result] = await pool.execute(
      'INSERT INTO leave_grants (employeeId, leaveTypeId, totalDays, deadline, note, createdBy) VALUES (?, ?, ?, ?, ?, ?)',
      [employeeId, leaveTypeId, totalDays, deadline || null, note || null, req.user.username]
    );

    const [newGrant] = await pool.execute(`
      SELECT lg.*, e.name as employee, lt.name as leaveTypeName
      FROM leave_grants lg
      LEFT JOIN employees e ON lg.employeeId = e.employeeId
      LEFT JOIN leave_types lt ON lg.leaveTypeId = lt.id
      WHERE lg.id = ?
    `, [result.insertId]);
    res.json(newGrant[0]);
  } catch (error) {
    console.error('Error creating leave grant:', error);
    res.status(500).json({ error: '新增假別核給失敗', detail: error.message });
  }
});

api.delete('/leave-grants/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT usedDays FROM leave_grants WHERE id = ?', [id]);
    if (!rows[0]) {
      return res.status(404).json({ error: '找不到該筆核給紀錄' });
    }
    if (rows[0].usedDays > 0) {
      return res.status(400).json({ error: '已有請假申請使用這筆核給，無法刪除' });
    }
    await pool.execute('DELETE FROM leave_grants WHERE id = ?', [id]);
    res.json({ message: '核給紀錄已刪除' });
  } catch (error) {
    console.error('Error deleting leave grant:', error);
    res.status(500).json({ error: '刪除假別核給失敗', detail: error.message });
  }
});

// 請假申請 API 路由

api.get('/leave-applications', async (req, res) => {
  try {
    // employee 角色只能看到自己的請假紀錄，其餘角色可看全公司
    const isEmployee = req.user.role === 'employee';
    const [rows] = await pool.execute(`
      SELECT
        la.*,
        e.name as employee,
        lt.name as type
      FROM leave_applications la
      LEFT JOIN employees e ON la.employeeId = e.employeeId
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      ${isEmployee ? 'WHERE la.employeeId = ?' : ''}
      ORDER BY la.created_at DESC
    `, isEmployee ? [req.user.employeeId] : []);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave applications:', error);
    res.status(500).json({ error: '獲取請假申請失敗', detail: error.message });
  }
});

api.post('/leave-applications', async (req, res) => {
  try {
    // employee 角色只能為自己申請，強制以登入帳號綁定的 employeeId 覆蓋前端傳入值
    const employeeId = req.user.role === 'employee' ? req.user.employeeId : req.body.employeeId;
    const { leaveTypeId, startDate, endDate, startTime, endTime, reason, deputy } = req.body;

    const [leaveTypeRows] = await pool.execute('SELECT code FROM leave_types WHERE id = ?', [leaveTypeId]);
    const leaveTypeCode = leaveTypeRows[0]?.code;

    // 生理假依性別工作平等法第 14 條僅限女性受僱者申請；未填寫性別的員工不擋下，
    // 避免資料不完整時誤擋合理申請，請 HR 之後補上性別資料
    if (leaveTypeCode === 'MSL') {
      const [employeeRows] = await pool.execute('SELECT gender FROM employees WHERE employeeId = ?', [employeeId]);
      if (employeeRows[0]?.gender === 'male') {
        return res.status(400).json({ error: '生理假僅限女性員工申請' });
      }
    }

    let daysDiff;
    if (leaveTypeCode === 'COMP') {
      // 補休以小時為單位，同一天內用開始/結束時間精確計算，不比照其他假別用日期差
      if (!startTime || !endTime || startDate !== endDate) {
        return res.status(400).json({ error: '補休請選擇同一天的開始與結束時間' });
      }
      // 自動扣除與中午 12:00-13:00 午休時段重疊的部分，避免橫跨午休時多扣補休
      const hoursDiff = calculateWorkingHours(startTime, endTime);
      if (!(hoursDiff > 0)) {
        return res.status(400).json({ error: '扣除午休時段後時數需大於 0，請確認開始與結束時間' });
      }
      daysDiff = Math.round(hoursDiff * 10) / 10;
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end.getTime() - start.getTime();
      daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    }

    // 若該員工此假別有尚未到期、還有剩餘天數的核給紀錄，自動關聯（同一事由分次請假用）
    const [grantRows] = await pool.execute(
      `SELECT id FROM leave_grants
       WHERE employeeId = ? AND leaveTypeId = ? AND usedDays < totalDays
         AND (deadline IS NULL OR deadline >= CURDATE())
       ORDER BY created_at ASC LIMIT 1`,
      [employeeId, leaveTypeId]
    );
    const grantId = grantRows[0]?.id || null;

    const [result] = await pool.execute(
      'INSERT INTO leave_applications (employeeId, leaveTypeId, grantId, startDate, endDate, startTime, endTime, days, reason, deputy, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, leaveTypeId, grantId, startDate, endDate, startTime || null, endTime || null, daysDiff, reason, deputy || null, 'pending']
    );

    const [newApplication] = await pool.execute(`
      SELECT
        la.*,
        e.name as employee,
        lt.name as type
      FROM leave_applications la
      LEFT JOIN employees e ON la.employeeId = e.employeeId
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      WHERE la.id = ?
    `, [result.insertId]);

    const application = newApplication[0];
    const daysLabel = leaveTypeCode === 'COMP' ? `${application.days} 小時` : `${application.days} 天`;
    sendNotification(
      pool,
      '新的請假申請待審核',
      `${application.employee}（${application.employeeId}）提交了一筆${application.type}申請（${application.startDate} ~ ${application.endDate}，共 ${daysLabel}），請至系統審核。`
    );

    res.json(application);
  } catch (error) {
    console.error('Error creating leave application:', error);
    res.status(500).json({ error: '新增請假申請失敗', detail: error.message });
  }
});

// 上傳請假證明文件（如訃聞、診斷證明）；本人或 HR/主管可上傳，會覆蓋舊檔案
api.post('/leave-applications/:id/attachment', (req, res, next) => {
  uploadAttachment.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: '請選擇要上傳的檔案' });
    }

    const [rows] = await pool.execute('SELECT employeeId, attachment FROM leave_applications WHERE id = ?', [id]);
    const application = rows[0];
    if (!application) {
      return res.status(404).json({ error: '找不到該筆請假申請' });
    }
    if (req.user.role === 'employee' && application.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: '無權操作他人的請假申請' });
    }

    if (application.attachment) {
      fs.unlink(path.join(UPLOAD_DIR, application.attachment), () => {});
    }

    await pool.execute('UPDATE leave_applications SET attachment = ? WHERE id = ?', [req.file.filename, id]);
    res.json({ message: '附件上傳成功' });
  } catch (error) {
    console.error('Error uploading leave application attachment:', error);
    res.status(500).json({ error: '附件上傳失敗', detail: error.message });
  }
});

// 下載請假證明文件；本人或 HR/主管可下載
api.get('/leave-applications/:id/attachment', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT employeeId, attachment FROM leave_applications WHERE id = ?', [id]);
    const application = rows[0];
    if (!application || !application.attachment) {
      return res.status(404).json({ error: '找不到附件' });
    }
    if (req.user.role === 'employee' && application.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: '無權查看他人的附件' });
    }

    const filePath = path.join(UPLOAD_DIR, application.attachment);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '附件檔案遺失' });
    }
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading leave application attachment:', error);
    res.status(500).json({ error: '下載附件失敗', detail: error.message });
  }
});

api.put('/leave-applications/:id/status', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver, days, reviewNote } = req.body;

    const [beforeRows] = await pool.execute(`
      SELECT la.employeeId, la.days, la.status as previousStatus, la.grantId, lt.code as leaveTypeCode, e.joinDate
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      LEFT JOIN employees e ON la.employeeId = e.employeeId
      WHERE la.id = ?
    `, [id]);
    const application = beforeRows[0];
    if (!application) {
      return res.status(404).json({ error: '找不到該筆請假申請' });
    }

    // 核准時可由 HR/主管調整實際核准天數（例如依喪假訃聞判斷的親屬關係天數），
    // 不一定等於員工申請當下試算的天數；未提供則沿用原本天數
    const finalDays = (days !== undefined && days !== null && days !== '') ? Number(days) : application.days;

    // 若這筆申請關聯到假別核給紀錄，核准時檢查不能超過核給剩餘天數
    let grant = null;
    if (application.grantId) {
      const [grantRows] = await pool.execute('SELECT * FROM leave_grants WHERE id = ?', [application.grantId]);
      grant = grantRows[0] || null;
    }
    if (grant && status === 'approved' && application.previousStatus !== 'approved') {
      const remaining = grant.totalDays - grant.usedDays;
      if (finalDays > remaining) {
        return res.status(400).json({ error: `超過核給天數上限，此核給剩餘 ${remaining} 天` });
      }
    }

    // 補休假別核准前先確認剩餘補休時數足夠，避免核准後才發現額度不足
    if (application.leaveTypeCode === 'COMP' && status === 'approved' && application.previousStatus !== 'approved') {
      const [balanceRows] = await pool.execute(
        `SELECT IFNULL(SUM(hours - usedHours), 0) as remaining FROM comp_time_grants
         WHERE employeeId = ? AND settledAt IS NULL AND deadline >= CURDATE()`,
        [application.employeeId]
      );
      if (Number(balanceRows[0].remaining) < finalDays - 0.001) {
        return res.status(400).json({ error: `補休餘額不足，目前可用 ${balanceRows[0].remaining} 小時` });
      }
    }

    await pool.execute(
      'UPDATE leave_applications SET status = ?, approver = ?, days = ?, reviewNote = ? WHERE id = ?',
      [status, approver, finalDays, reviewNote || null, id]
    );

    // 特休申請核准時計入目前週年期間的已用天數（以最終核准天數計）；若從已核准改回其他狀態則退回
    if (application.leaveTypeCode === 'AL' && application.joinDate) {
      if (status === 'approved' && application.previousStatus !== 'approved') {
        const period = await getOrCreateActivePeriod(application.employeeId, application.joinDate);
        await pool.execute('UPDATE leave_periods SET usedDays = usedDays + ? WHERE id = ?', [finalDays, period.id]);
      } else if (status !== 'approved' && application.previousStatus === 'approved') {
        const period = await getOrCreateActivePeriod(application.employeeId, application.joinDate);
        await pool.execute('UPDATE leave_periods SET usedDays = GREATEST(0, usedDays - ?) WHERE id = ?', [application.days, period.id]);
      }
    }

    // 有關聯假別核給紀錄的申請，核准/取消核准時同步扣抵/退回核給的已用天數
    if (grant) {
      if (status === 'approved' && application.previousStatus !== 'approved') {
        await pool.execute('UPDATE leave_grants SET usedDays = usedDays + ? WHERE id = ?', [finalDays, grant.id]);
      } else if (status !== 'approved' && application.previousStatus === 'approved') {
        await pool.execute('UPDATE leave_grants SET usedDays = GREATEST(0, usedDays - ?) WHERE id = ?', [application.days, grant.id]);
      }
    }

    // 補休假別：核准時依到期日由近到遠扣抵補休額度，取消核准時歸還
    if (application.leaveTypeCode === 'COMP') {
      if (status === 'approved' && application.previousStatus !== 'approved') {
        await allocateCompHours(pool, application.employeeId, finalDays, id);
      } else if (status !== 'approved' && application.previousStatus === 'approved') {
        await releaseCompHours(pool, id);
      }
    }

    const [updatedApplication] = await pool.execute(`
      SELECT
        la.*,
        e.name as employee,
        lt.name as type
      FROM leave_applications la
      LEFT JOIN employees e ON la.employeeId = e.employeeId
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      WHERE la.id = ?
    `, [id]);

    res.json(updatedApplication[0]);
  } catch (error) {
    console.error('Error updating leave application status:', error);
    res.status(500).json({ error: '更新請假申請狀態失敗', detail: error.message });
  }
});

// 假別餘額 API 路由

// 特休（annualLeave/annualLeaveUsed）改由目前尚未結算的 leave_periods 即時計算：
// 可用天數＝本期發放＋上期遞延，已用天數＝本期已核准的特休申請累計。
// 補休（compensatoryLeave/compensatoryLeaveUsed）改由未到期、未結算的 comp_time_grants
// 即時加總，不再是可手動調整的欄位（來源是加班核准時自動開立的額度）
const LEAVE_BALANCE_SELECT = `
  SELECT
    lb.id, lb.employeeId, lb.sickLeave, lb.sickLeaveUsed, lb.updated_at,
    e.name as employee,
    lp.id as activePeriodId,
    IFNULL(lp.grantedDays + lp.carriedInDays, 0) as annualLeave,
    IFNULL(lp.usedDays, 0) as annualLeaveUsed,
    IFNULL(comp.granted, 0) as compensatoryLeave,
    IFNULL(comp.used, 0) as compensatoryLeaveUsed,
    comp.nearestDeadline as compensatoryLeaveDeadline
  FROM leave_balances lb
  LEFT JOIN employees e ON lb.employeeId = e.employeeId
  LEFT JOIN leave_periods lp ON lp.id = (
    SELECT id FROM leave_periods lp2
    WHERE lp2.employeeId = lb.employeeId AND lp2.settledAt IS NULL
    ORDER BY lp2.periodStart DESC LIMIT 1
  )
  LEFT JOIN (
    SELECT employeeId,
      SUM(hours) as granted,
      SUM(usedHours) as used,
      MIN(CASE WHEN hours > usedHours THEN deadline END) as nearestDeadline
    FROM comp_time_grants
    WHERE settledAt IS NULL AND deadline >= CURDATE()
    GROUP BY employeeId
  ) comp ON comp.employeeId = lb.employeeId
`;

api.get('/leave-balances', async (req, res) => {
  try {
    // employee 角色只能看到自己的假別餘額
    const isEmployee = req.user.role === 'employee';
    const [rows] = await pool.execute(
      `${LEAVE_BALANCE_SELECT} ${isEmployee ? 'WHERE lb.employeeId = ?' : ''} ORDER BY lb.employeeId`,
      isEmployee ? [req.user.employeeId] : []
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    res.status(500).json({ error: '獲取假別餘額失敗', detail: error.message });
  }
});

api.put('/leave-balances/:employeeId', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { sickLeave, sickLeaveUsed } = req.body;

    await pool.execute(
      'UPDATE leave_balances SET sickLeave = ?, sickLeaveUsed = ? WHERE employeeId = ?',
      [sickLeave, sickLeaveUsed, employeeId]
    );

    const [updatedBalance] = await pool.execute(`${LEAVE_BALANCE_SELECT} WHERE lb.employeeId = ?`, [employeeId]);

    res.json(updatedBalance[0]);
  } catch (error) {
    console.error('Error updating leave balance:', error);
    res.status(500).json({ error: '更新假別餘額失敗', detail: error.message });
  }
});

// 重新整理所有在職員工「目前這期」的特休發放天數（勞基法第 38 條年資級距），
// 用於到職未滿一年、跨過 6 個月門檻等年資級距中途變動的情況；已用天數不受影響
api.post('/leave-balances/recalculate', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [employees] = await pool.execute('SELECT employeeId, joinDate FROM employees WHERE active = TRUE');

    let updated = 0;
    for (const employee of employees) {
      const period = await getOrCreateActivePeriod(employee.employeeId, employee.joinDate);
      const grantedDays = computePeriodGrant(employee.joinDate, period.periodEnd);
      await pool.execute('UPDATE leave_periods SET grantedDays = ? WHERE id = ?', [grantedDays, period.id]);
      updated += 1;
    }

    res.json({ message: '特休天數已重新計算', updated });
  } catch (error) {
    console.error('Error recalculating annual leave:', error);
    res.status(500).json({ error: '重新計算特休天數失敗', detail: error.message });
  }
});

// 特休週年結算 API 路由（僅 HR/主管）

// 查詢某員工的特休週年紀錄（含歷史已結算的期間）
api.get('/leave-periods', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { employeeId } = req.query;
    const params = [];
    let query = `
      SELECT lp.*, e.name as employee
      FROM leave_periods lp
      LEFT JOIN employees e ON lp.employeeId = e.employeeId
    `;
    if (employeeId) {
      query += ' WHERE lp.employeeId = ?';
      params.push(employeeId);
    }
    query += ' ORDER BY lp.employeeId, lp.periodStart DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave periods:', error);
    res.status(500).json({ error: '獲取特休週年紀錄失敗', detail: error.message });
  }
});

// 直接調整某期特休的已用天數。用途：(1) 系統上線時導入既有員工，事後補登
// 他們在此之前已休掉的天數 (2) 更正誤植的核准紀錄。不限制上限，由 HR 專業判斷
api.put('/leave-periods/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { usedDays } = req.body;
    if (usedDays === undefined || usedDays === null || Number(usedDays) < 0) {
      return res.status(400).json({ error: '已用天數不可為負數' });
    }

    const [result] = await pool.execute('UPDATE leave_periods SET usedDays = ? WHERE id = ?', [Number(usedDays), id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到該筆特休週年紀錄' });
    }

    const [rows] = await pool.execute('SELECT * FROM leave_periods WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error adjusting leave period usedDays:', error);
    res.status(500).json({ error: '調整特休已用天數失敗', detail: error.message });
  }
});

// 列出已到期但尚未結算的特休週年期間，供 HR 決定遞延/折現天數
api.get('/leave-periods/pending-settlement', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT lp.*, e.name as employee, e.monthlySalary
      FROM leave_periods lp
      LEFT JOIN employees e ON lp.employeeId = e.employeeId
      WHERE lp.settledAt IS NULL AND lp.periodEnd <= CURDATE()
      ORDER BY lp.periodEnd
    `);
    const withComputed = rows.map((period) => ({
      ...period,
      ...computeSettlementSplit(period),
    }));
    res.json(withComputed);
  } catch (error) {
    console.error('Error fetching pending leave period settlements:', error);
    res.status(500).json({ error: '獲取待結算特休週年清單失敗', detail: error.message });
  }
});

// 結算一筆到期的特休週年期間：依勞基法第 38 條，本期新發放且尚未休完的天數可
// 選擇遞延一次或折現，但上一期遞延進來、這期仍未休完的天數不可再遞延，必須全數折現
api.post('/leave-periods/:id/settle', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const carryOverDays = Number(req.body.carryOverDays) || 0;

    const [rows] = await pool.execute(`
      SELECT lp.*, e.monthlySalary, e.joinDate
      FROM leave_periods lp
      LEFT JOIN employees e ON lp.employeeId = e.employeeId
      WHERE lp.id = ?
    `, [id]);
    const period = rows[0];
    if (!period) {
      return res.status(404).json({ error: '找不到該筆特休週年紀錄' });
    }
    if (period.settledAt) {
      return res.status(400).json({ error: '這筆週年紀錄已經結算過' });
    }

    const { mandatoryCashOutDays, remainingGrantDays } = computeSettlementSplit(period);
    if (carryOverDays < 0 || carryOverDays > remainingGrantDays) {
      return res.status(400).json({ error: `遞延天數必須介於 0 到 ${remainingGrantDays} 之間` });
    }

    const cashOutDays = mandatoryCashOutDays + (remainingGrantDays - carryOverDays);
    const dailyWage = period.monthlySalary ? period.monthlySalary / 30 : null;
    const cashOutAmount = dailyWage !== null ? Math.round(cashOutDays * dailyWage) : null;

    await pool.execute(
      'UPDATE leave_periods SET settledAt = NOW(), carriedOutDays = ?, cashOutDays = ?, cashOutAmount = ? WHERE id = ?',
      [carryOverDays, cashOutDays, cashOutAmount, id]
    );

    // 開出下一期
    const nextPeriodEnd = addOneYear(period.periodEnd);
    const nextGrantedDays = computePeriodGrant(period.joinDate, nextPeriodEnd);
    await pool.execute(
      'INSERT INTO leave_periods (employeeId, periodStart, periodEnd, grantedDays, carriedInDays, usedDays) VALUES (?, ?, ?, ?, ?, 0)',
      [period.employeeId, period.periodEnd, nextPeriodEnd, nextGrantedDays, carryOverDays]
    );

    res.json({
      message: '結算完成',
      cashOutDays,
      cashOutAmount,
      carriedOutDays: carryOverDays,
      warning: dailyWage === null ? '該員工尚未設定月薪，無法計算折現金額，請補上月薪後自行換算' : null,
    });
  } catch (error) {
    console.error('Error settling leave period:', error);
    res.status(500).json({ error: '特休結算失敗', detail: error.message });
  }
});

// 國定假日行事曆 API 路由

api.get('/holidays', async (req, res) => {
  try {
    const { year } = req.query;
    const params = [];
    let query = 'SELECT * FROM holidays';
    if (year) {
      query += ' WHERE YEAR(date) = ?';
      params.push(year);
    }
    query += ' ORDER BY date';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: '獲取國定假日失敗', detail: error.message });
  }
});

api.post('/holidays', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { date, name, isHoliday } = req.body;
    if (!date) {
      return res.status(400).json({ error: '日期為必填' });
    }
    await pool.execute(
      `INSERT INTO holidays (date, name, isHoliday, source) VALUES (?, ?, ?, 'manual')
       ON DUPLICATE KEY UPDATE name = VALUES(name), isHoliday = VALUES(isHoliday), source = 'manual'`,
      [date, name || null, isHoliday !== undefined ? isHoliday : true]
    );
    const [rows] = await pool.execute('SELECT * FROM holidays WHERE date = ?', [date]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({ error: '新增國定假日失敗', detail: error.message });
  }
});

// 匯入人事行政總處公布的政府行政機關辦公日曆表 CSV（西元日期,星期,是否放假,備註）
api.post('/holidays/import', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) {
      return res.status(400).json({ error: '請提供 CSV 內容' });
    }

    const rows = parseHolidayCsv(csv);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV 中沒有可匯入的日期資料' });
    }

    for (const row of rows) {
      await pool.execute(
        `INSERT INTO holidays (date, name, isHoliday, source) VALUES (?, ?, ?, 'dgpa')
         ON DUPLICATE KEY UPDATE name = VALUES(name), isHoliday = VALUES(isHoliday), source = 'dgpa'`,
        [row.date, row.name, row.isHoliday]
      );
    }

    res.json({ message: '國定假日匯入成功', imported: rows.length });
  } catch (error) {
    console.error('Error importing holidays:', error);
    res.status(400).json({ error: '匯入國定假日失敗', detail: error.message });
  }
});

api.delete('/holidays/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM holidays WHERE id = ?', [id]);
    res.json({ message: '假日刪除成功' });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ error: '刪除假日失敗', detail: error.message });
  }
});

// 考勤 API 路由（僅 HR/主管）：資料來自外部打卡系統匯出的 .xls，透過員工的
// 「考勤帳號」比對到系統內的員工，未設定考勤帳號的匯入資料列會列在 unmatchedAccounts

// 考勤匯入範例檔：示範 parseAttendanceXls 預期的欄位格式（標題列＋日期欄位、
// 缺卡／休息日／請假／正常簽到退等各種儲存格內容範例），供 HR 依此格式整理資料
api.get('/attendance/import-template', requireRole(...STAFF_ROLES), (req, res) => {
  const data = [
    ['部門', '人員帳號', '人員姓名', '班別', '07-01', '', '07-02', '', '07-03', ''],
    ['', '', '', '', '簽到', '簽退', '簽到', '簽退', '簽到', '簽退'],
    ['範例部門', 'employee01', '範例員工一', '09:00-18:00', '09:02', '18:05', '09:15', '18:00', '缺卡', '缺卡'],
    ['範例部門', 'employee02', '範例員工二', '09:00-18:00', '休息日', '休息日', '特休', '特休', '09:00', '18:10'],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '考勤紀錄範例');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-import-template.xlsx"');
  res.send(buffer);
});

api.post('/attendance/import', requireRole(...STAFF_ROLES), (req, res, next) => {
  uploadImportFile.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請選擇要匯入的考勤檔案' });
    }
    const year = Number(req.body.year);
    if (!year || year < 2000 || year > 2100) {
      return res.status(400).json({ error: '請提供正確的西元年' });
    }

    let records;
    try {
      records = parseAttendanceXls(req.file.buffer, year);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message });
    }
    if (records.length === 0) {
      return res.status(400).json({ error: '檔案中沒有可匯入的考勤資料' });
    }

    const [employeeRows] = await pool.execute(
      'SELECT employeeId, attendanceAccount FROM employees WHERE attendanceAccount IS NOT NULL'
    );
    const accountMap = new Map(employeeRows.map((e) => [e.attendanceAccount, e.employeeId]));

    let imported = 0;
    const unmatchedAccounts = new Set();
    for (const record of records) {
      const employeeId = accountMap.get(record.account);
      if (!employeeId) {
        unmatchedAccounts.add(record.account);
        continue;
      }
      await pool.execute(
        `INSERT INTO attendance_records (employeeId, date, shiftStart, shiftEnd, clockIn, clockOut, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE shiftStart = VALUES(shiftStart), shiftEnd = VALUES(shiftEnd),
           clockIn = VALUES(clockIn), clockOut = VALUES(clockOut), status = VALUES(status), note = VALUES(note)`,
        [employeeId, record.date, record.shiftStart, record.shiftEnd, record.clockIn, record.clockOut, record.status, record.note]
      );
      imported += 1;
    }

    res.json({
      message: '匯入完成',
      imported,
      unmatchedAccounts: Array.from(unmatchedAccounts),
    });
  } catch (error) {
    console.error('Error importing attendance:', error);
    res.status(500).json({ error: '匯入考勤資料失敗', detail: error.message });
  }
});

// 某年月的考勤明細（可選員工篩選），供報表明細表使用。isLate/isEarlyLeave
// 判斷邏輯與 /attendance/summary 的遲到早退次數統計一致（同樣的容許緩衝分鐘數），
// 讓「明細列表」跟「統計次數」永遠對得上，不會各自維護一套邏輯而算出不同結果
api.get('/attendance/records', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { year, month, employeeId } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: '請提供年月' });
    }
    const graceTime = `00:${String(ATTENDANCE_GRACE_MINUTES).padStart(2, '0')}:00`;
    const params = [graceTime, graceTime, String(year), String(month).padStart(2, '0')];
    let query = `
      SELECT a.*, e.name as employeeName, e.department,
        (a.status = 'normal' AND a.shiftStart IS NOT NULL AND a.clockIn > ADDTIME(a.shiftStart, ?)) as isLate,
        (a.status = 'normal' AND a.shiftEnd IS NOT NULL AND a.shiftEnd > a.shiftStart AND a.clockOut < SUBTIME(a.shiftEnd, ?)) as isEarlyLeave
      FROM attendance_records a
      LEFT JOIN employees e ON a.employeeId = e.employeeId
      WHERE DATE_FORMAT(a.date, '%Y-%m') = CONCAT(?, '-', ?)
    `;
    if (employeeId) {
      query += ' AND a.employeeId = ?';
      params.push(employeeId);
    }
    query += ' ORDER BY a.date, a.employeeId';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({ error: '獲取考勤紀錄失敗', detail: error.message });
  }
});

// 某年月每位員工的統計摘要：正常/缺卡/請假/休息天數與遲到早退次數。
// 遲到早退只在 status='normal' 且有排班時間可比對時計算，容許 ATTENDANCE_GRACE_MINUTES
// 分鐘的緩衝；跨夜班別（如 18:00-06:00）的早退判斷用時間字串直接比較會不準，
// 屬已知限制，跨夜班別的紀錄目前很少見所以先不特別處理
api.get('/attendance/summary', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: '請提供年月' });
    }
    const [rows] = await pool.execute(
      `SELECT
        a.employeeId, e.name as employeeName, e.department,
        COUNT(*) as totalDays,
        SUM(a.status = 'normal') as normalDays,
        SUM(a.status = 'missing') as missingDays,
        SUM(a.status = 'day_off') as dayOffDays,
        SUM(a.status = 'leave') as leaveDays,
        SUM(a.status = 'normal' AND a.shiftStart IS NOT NULL AND a.clockIn > ADDTIME(a.shiftStart, ?)) as lateCount,
        SUM(a.status = 'normal' AND a.shiftEnd IS NOT NULL AND a.shiftEnd > a.shiftStart AND a.clockOut < SUBTIME(a.shiftEnd, ?)) as earlyLeaveCount
      FROM attendance_records a
      LEFT JOIN employees e ON a.employeeId = e.employeeId
      WHERE DATE_FORMAT(a.date, '%Y-%m') = CONCAT(?, '-', ?)
      GROUP BY a.employeeId, e.name, e.department
      ORDER BY e.department, a.employeeId`,
      [`00:${String(ATTENDANCE_GRACE_MINUTES).padStart(2, '0')}:00`, `00:${String(ATTENDANCE_GRACE_MINUTES).padStart(2, '0')}:00`, String(year), String(month).padStart(2, '0')]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({ error: '獲取考勤統計失敗', detail: error.message });
  }
});

// 請假紀錄匯入範例檔：示範 parseLeaveXls 預期的欄位格式，標題列與真實外部系統
// 匯出的檔案一致，範例資料展示「請假天數」與「請假時數」兩種填法
api.get('/leaves/import-template', requireRole(...STAFF_ROLES), (req, res) => {
  const data = [
    ['部門名稱', '人員帳號', '人員姓名', '假別', '事件項目', '事件發生日', '請假開始時間', '請假結束時間', '請假天數', '請假時數', '請假分鐘數', '是否計入出勤時數', '請假原因', '紀錄來源', '狀態', '申請時間', '附件1'],
    ['範例部門', 'employee01', '範例員工一', '特休', '', '', '2026/01/05 09:00:00', '2026/01/05 18:00:00', '1', '', '', '否', '', '請假申請單', '已生效', '2026/01/01 10:00', ''],
    ['範例部門', 'employee02', '範例員工二', '病假', '', '', '2026/01/06 17:00:00', '2026/01/06 18:00:00', '', '1', '', '否', '去看醫生', '請假申請單', '已生效', '2026/01/06 16:00', ''],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '請假紀錄範例');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="leave-import-template.xlsx"');
  res.send(buffer);
});

// 請假紀錄匯入 API（僅 HR/主管）：資料來自外部打卡系統匯出的「請假紀錄」.xls，
// 透過員工的「考勤帳號」比對到系統內的員工，用於補齊「報表 → 請假分析」在正式
// 數位化請假申請功能上線前的歷史/既有請假資料，不會寫入 leave_applications，
// 也不影響假別餘額或核准流程，純粹供報表統計使用
api.post('/leaves/import', requireRole(...STAFF_ROLES), (req, res, next) => {
  uploadImportFile.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請選擇要匯入的請假紀錄檔案' });
    }

    let records;
    try {
      records = parseLeaveXls(req.file.buffer);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message });
    }
    if (records.length === 0) {
      return res.status(400).json({ error: '檔案中沒有可匯入的請假紀錄' });
    }

    const [employeeRows] = await pool.execute(
      'SELECT employeeId, attendanceAccount FROM employees WHERE attendanceAccount IS NOT NULL'
    );
    const accountMap = new Map(employeeRows.map((e) => [e.attendanceAccount, e.employeeId]));

    let imported = 0;
    const unmatchedAccounts = new Set();
    for (const record of records) {
      const employeeId = accountMap.get(record.account);
      if (!employeeId) {
        unmatchedAccounts.add(record.account);
        continue;
      }
      await pool.execute(
        `INSERT INTO imported_leave_records (employeeId, leaveType, startDateTime, endDateTime, days, hours, minutes, status, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE days = VALUES(days), hours = VALUES(hours), minutes = VALUES(minutes),
           status = VALUES(status), reason = VALUES(reason)`,
        [employeeId, record.leaveType, record.startDateTime, record.endDateTime, record.days, record.hours, record.minutes, record.status, record.reason]
      );
      imported += 1;
    }

    res.json({
      message: '匯入完成',
      imported,
      unmatchedAccounts: Array.from(unmatchedAccounts),
    });
  } catch (error) {
    console.error('Error importing leave records:', error);
    res.status(500).json({ error: '匯入請假紀錄失敗', detail: error.message });
  }
});

// 加班申請 API 路由

api.get('/overtime-applications', async (req, res) => {
  try {
    // employee 角色只能看到自己的加班紀錄
    const isEmployee = req.user.role === 'employee';
    const [rows] = await pool.execute(`
      SELECT
        o.*,
        e.name as employee
      FROM overtime_applications o
      LEFT JOIN employees e ON o.employeeId = e.employeeId
      ${isEmployee ? 'WHERE o.employeeId = ?' : ''}
      ORDER BY o.created_at DESC
    `, isEmployee ? [req.user.employeeId] : []);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching overtime applications:', error);
    res.status(500).json({ error: '獲取加班申請失敗', detail: error.message });
  }
});

api.post('/overtime-applications', async (req, res) => {
  try {
    // employee 角色只能為自己申請，強制以登入帳號綁定的 employeeId 覆蓋前端傳入值
    const employeeId = req.user.role === 'employee' ? req.user.employeeId : req.body.employeeId;
    const { date, startTime, endTime, reason, compensationType } = req.body;
    if (!employeeId || !date || !startTime || !endTime || !reason) {
      return res.status(400).json({ error: '所有必填欄位皆需填寫' });
    }

    // 自動扣除與中午 12:00-13:00 午休時段重疊的部分，避免整天加班橫跨午休時多算時數
    const hours = calculateWorkingHours(startTime, endTime);
    if (!(hours > 0)) {
      return res.status(400).json({ error: '扣除午休時段後時數需大於 0，請確認開始與結束時間' });
    }

    const [holidayRows] = await pool.execute('SELECT isHoliday FROM holidays WHERE date = ?', [date]);
    const dayOfWeek = new Date(date).getUTCDay();
    const onHoliday = holidayRows.length > 0
      ? Boolean(holidayRows[0].isHoliday)
      : (dayOfWeek === 0 || dayOfWeek === 6);

    const finalCompensationType = compensationType === 'comp' ? 'comp' : 'pay';
    const compHours = calculateCompHours(hours);

    const [result] = await pool.execute(
      'INSERT INTO overtime_applications (employeeId, date, startTime, endTime, hours, reason, onHoliday, compensationType, compHours, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, date, startTime, endTime, hours, reason, onHoliday, finalCompensationType, compHours, 'pending']
    );

    const [newApplication] = await pool.execute(`
      SELECT o.*, e.name as employee
      FROM overtime_applications o
      LEFT JOIN employees e ON o.employeeId = e.employeeId
      WHERE o.id = ?
    `, [result.insertId]);

    const application = newApplication[0];
    sendNotification(
      pool,
      '新的加班申請待審核',
      `${application.employee}（${application.employeeId}）提交了一筆加班申請（${application.date} ${application.startTime}-${application.endTime}，共 ${application.hours} 小時），請至系統審核。`
    );

    res.json(application);
  } catch (error) {
    console.error('Error creating overtime application:', error);
    res.status(500).json({ error: '新增加班申請失敗', detail: error.message });
  }
});

api.put('/overtime-applications/:id/status', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver, reviewNote } = req.body;

    const [beforeRows] = await pool.execute(
      'SELECT employeeId, date, compensationType, compHours, status as previousStatus FROM overtime_applications WHERE id = ?',
      [id]
    );
    const application = beforeRows[0];
    if (!application) {
      return res.status(404).json({ error: '找不到該筆加班申請' });
    }

    // 換補休的加班一旦補休已被請假申請使用，就不能取消核准，否則額度會變成負的
    if (application.compensationType === 'comp' && status !== 'approved' && application.previousStatus === 'approved') {
      const [grantRows] = await pool.execute('SELECT usedHours FROM comp_time_grants WHERE overtimeApplicationId = ?', [id]);
      if (grantRows[0] && grantRows[0].usedHours > 0) {
        return res.status(400).json({ error: '這筆加班換算的補休已被請假使用，無法取消核准' });
      }
    }

    await pool.execute(
      'UPDATE overtime_applications SET status = ?, approver = ?, reviewNote = ? WHERE id = ?',
      [status, approver, reviewNote || null, id]
    );

    // 選擇換補休的加班申請：核准時依工作時數 1:1 開立補休額度（6 個月內休畢），取消核准時移除
    if (application.compensationType === 'comp') {
      if (status === 'approved' && application.previousStatus !== 'approved') {
        const deadline = addMonths(application.date, 6);
        await pool.execute(
          'INSERT INTO comp_time_grants (employeeId, overtimeApplicationId, hours, deadline) VALUES (?, ?, ?, ?)',
          [application.employeeId, id, application.compHours, deadline]
        );
      } else if (status !== 'approved' && application.previousStatus === 'approved') {
        await pool.execute('DELETE FROM comp_time_grants WHERE overtimeApplicationId = ?', [id]);
      }
    }

    const [updatedApplication] = await pool.execute(`
      SELECT o.*, e.name as employee
      FROM overtime_applications o
      LEFT JOIN employees e ON o.employeeId = e.employeeId
      WHERE o.id = ?
    `, [id]);

    res.json(updatedApplication[0]);
  } catch (error) {
    console.error('Error updating overtime application status:', error);
    res.status(500).json({ error: '更新加班申請狀態失敗', detail: error.message });
  }
});

// 補休額度 API 路由

// 查詢補休額度明細（哪幾筆加班換來的、各自到期日與使用狀況）；
// employee 角色只能看自己的，HR/主管可用 employeeId 篩選或看全公司
api.get('/comp-time-grants', async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    const employeeId = isEmployee ? req.user.employeeId : req.query.employeeId;
    const params = [];
    let query = `
      SELECT ctg.*, e.name as employee, o.date as overtimeDate, o.hours as overtimeHours
      FROM comp_time_grants ctg
      LEFT JOIN employees e ON ctg.employeeId = e.employeeId
      LEFT JOIN overtime_applications o ON ctg.overtimeApplicationId = o.id
    `;
    if (employeeId) {
      query += ' WHERE ctg.employeeId = ?';
      params.push(employeeId);
    }
    query += ' ORDER BY ctg.deadline ASC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching comp time grants:', error);
    res.status(500).json({ error: '獲取補休額度失敗', detail: error.message });
  }
});

// 列出即將到期（預設 30 天內）但還沒過期、還有剩餘時數的補休額度，供 HR
// 提前提醒員工排休，避免到期後才發現只能折算加班費
api.get('/comp-time-grants/expiring-soon', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const [rows] = await pool.execute(
      `SELECT ctg.*, e.name as employee, o.date as overtimeDate
       FROM comp_time_grants ctg
       LEFT JOIN employees e ON ctg.employeeId = e.employeeId
       LEFT JOIN overtime_applications o ON ctg.overtimeApplicationId = o.id
       WHERE ctg.settledAt IS NULL AND ctg.hours > ctg.usedHours
         AND ctg.deadline >= CURDATE() AND ctg.deadline <= CURDATE() + INTERVAL ? DAY
       ORDER BY ctg.deadline ASC`,
      [days]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching expiring comp time grants:', error);
    res.status(500).json({ error: '獲取即將到期補休清單失敗', detail: error.message });
  }
});

// 列出已到期但尚未結算、還有剩餘時數的補休額度，供 HR 折算加班費
api.get('/comp-time-grants/pending-settlement', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT ctg.*, e.name as employee, e.monthlySalary, o.date as overtimeDate
      FROM comp_time_grants ctg
      LEFT JOIN employees e ON ctg.employeeId = e.employeeId
      LEFT JOIN overtime_applications o ON ctg.overtimeApplicationId = o.id
      WHERE ctg.settledAt IS NULL AND ctg.deadline < CURDATE() AND ctg.hours > ctg.usedHours
      ORDER BY ctg.deadline
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching pending comp time settlements:', error);
    res.status(500).json({ error: '獲取待結算補休清單失敗', detail: error.message });
  }
});

// 結算一筆到期未休完的補休額度：剩餘時數全數折算加班費（比照勞基法函釋，
// 補休僅能遞延一次的精神，逾期不可再遞延，需以加班費結清）
api.post('/comp-time-grants/:id/settle', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(`
      SELECT ctg.*, e.monthlySalary
      FROM comp_time_grants ctg
      LEFT JOIN employees e ON ctg.employeeId = e.employeeId
      WHERE ctg.id = ?
    `, [id]);
    const grant = rows[0];
    if (!grant) {
      return res.status(404).json({ error: '找不到該筆補休額度' });
    }
    if (grant.settledAt) {
      return res.status(400).json({ error: '這筆補休額度已經結算過' });
    }

    const cashOutHours = grant.hours - grant.usedHours;
    const hourlyWage = grant.monthlySalary ? grant.monthlySalary / 240 : null;
    const cashOutAmount = hourlyWage !== null ? Math.round(cashOutHours * hourlyWage) : null;

    await pool.execute(
      'UPDATE comp_time_grants SET settledAt = NOW(), cashOutHours = ?, cashOutAmount = ? WHERE id = ?',
      [cashOutHours, cashOutAmount, id]
    );

    res.json({
      message: '結算完成',
      cashOutHours,
      cashOutAmount,
      warning: hourlyWage === null ? '該員工尚未設定月薪，無法計算折現金額，請補上月薪後自行換算' : null,
    });
  } catch (error) {
    console.error('Error settling comp time grant:', error);
    res.status(500).json({ error: '補休結算失敗', detail: error.message });
  }
});

// Dashboard API 路由

api.get('/dashboard/stats', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [totalEmployees] = await pool.execute('SELECT COUNT(*) as count FROM employees WHERE active = true');
    const [monthlyLeaves] = await pool.execute(`
      SELECT COUNT(*) as count FROM leave_applications
      WHERE MONTH(startDate) = MONTH(CURRENT_DATE()) AND YEAR(startDate) = YEAR(CURRENT_DATE())
    `);

    // 出勤率 = 正常天數 ÷（正常＋缺卡天數），休息日/例假日/請假不計入分母，
    // 沒有任何考勤紀錄（尚未匯入過，或 attendance_records 表還沒建立——例如
    // migration 008 還沒套用）時回傳 null，前端會顯示「無資料」而不是讓整個
    // Dashboard 因為這張表查詢失敗而打不開
    let averageAttendance = null;
    try {
      const [attendanceRows] = await pool.execute(`
        SELECT ROUND(100 * SUM(status = 'normal') / NULLIF(SUM(status IN ('normal', 'missing')), 0)) as avgAttendance
        FROM attendance_records
        WHERE MONTH(date) = MONTH(CURRENT_DATE()) AND YEAR(date) = YEAR(CURRENT_DATE())
      `);
      averageAttendance = attendanceRows[0]?.avgAttendance ?? null;
    } catch (e) {
      console.error('attendance_records 查詢失敗（可能尚未套用 migration 008）：', e.message);
      averageAttendance = null;
    }

    // 待審核申請需同時計入請假與加班申請，否則加班申請永遠不會反映在儀表板上
    const [pendingLeave] = await pool.execute(`SELECT COUNT(*) as count FROM leave_applications WHERE status = 'pending'`);
    const [pendingOvertime] = await pool.execute(`SELECT COUNT(*) as count FROM overtime_applications WHERE status = 'pending'`);

    res.json({
      totalEmployees: totalEmployees[0].count,
      monthlyLeaves: monthlyLeaves[0].count,
      averageAttendance,
      pendingRequests: pendingLeave[0].count + pendingOvertime[0].count,
      pendingLeaveRequests: pendingLeave[0].count,
      pendingOvertimeRequests: pendingOvertime[0].count,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: '獲取統計資料失敗', detail: error.message });
  }
});

// leave（本月請假件數）與 overtime（本月平均加班時數）查詢既有資料；
// attendance（本月出勤率）查詢考勤紀錄，沒有匯入過考勤資料的部門會是 0
// 部門出勤率／請假／加班統計。attendance_records 相關的 JOIN 有可能因為
// migration 008 還沒套用（表不存在）而讓整個查詢失敗，這裡外層再包一層，
// 失敗時退回不含出勤率的版本（attendance 固定 0），避免整個 Dashboard 打不開
api.get('/dashboard/attendance', requireRole(...STAFF_ROLES), async (req, res) => {
  const { startDate, endDate } = req.query;
  const useRange = startDate && endDate;
  const attendanceDateFilter = useRange
    ? 'a.date >= ? AND a.date <= ?'
    : 'MONTH(a.date) = MONTH(CURRENT_DATE()) AND YEAR(a.date) = YEAR(CURRENT_DATE())';
  const leaveDateFilter = useRange
    ? 'la.startDate >= ? AND la.startDate <= ?'
    : 'MONTH(la.startDate) = MONTH(CURRENT_DATE()) AND YEAR(la.startDate) = YEAR(CURRENT_DATE())';
  const overtimeDateFilter = useRange
    ? 'o.date >= ? AND o.date <= ?'
    : 'MONTH(o.date) = MONTH(CURRENT_DATE()) AND YEAR(o.date) = YEAR(CURRENT_DATE())';
  const rangeParams = useRange ? [startDate, endDate] : [];
  try {
    const [rows] = await pool.execute(
      `SELECT
        d.name as name,
        IFNULL(attendance_stats.rate, 0) as attendance,
        IFNULL(leave_stats.leave_count, 0) as \`leave\`,
        IFNULL(overtime_stats.avg_hours, 0) as overtime
      FROM departments d
      LEFT JOIN (
        SELECT e.department,
          ROUND(100 * SUM(a.status = 'normal') / NULLIF(SUM(a.status IN ('normal', 'missing')), 0)) as rate
        FROM employees e
        LEFT JOIN attendance_records a ON a.employeeId = e.employeeId
          AND ${attendanceDateFilter}
        GROUP BY e.department
      ) attendance_stats ON attendance_stats.department = d.name
      LEFT JOIN (
        SELECT e.department, COUNT(la.id) as leave_count
        FROM employees e
        LEFT JOIN leave_applications la ON la.employeeId = e.employeeId
          AND ${leaveDateFilter}
        GROUP BY e.department
      ) leave_stats ON leave_stats.department = d.name
      LEFT JOIN (
        SELECT e.department, AVG(o.hours) as avg_hours
        FROM employees e
        LEFT JOIN overtime_applications o ON o.employeeId = e.employeeId
          AND ${overtimeDateFilter}
        GROUP BY e.department
      ) overtime_stats ON overtime_stats.department = d.name
      GROUP BY d.name`,
      [...rangeParams, ...rangeParams, ...rangeParams]
    );
    res.json(rows);
  } catch (error) {
    console.error('attendance_records 查詢失敗，改用不含出勤率的版本（可能尚未套用 migration 008）：', error.message);
    try {
      const [fallbackRows] = await pool.execute(
        `SELECT
          d.name as name,
          0 as attendance,
          IFNULL(leave_stats.leave_count, 0) as \`leave\`,
          IFNULL(overtime_stats.avg_hours, 0) as overtime
        FROM departments d
        LEFT JOIN (
          SELECT e.department, COUNT(la.id) as leave_count
          FROM employees e
          LEFT JOIN leave_applications la ON la.employeeId = e.employeeId
            AND ${leaveDateFilter}
          GROUP BY e.department
        ) leave_stats ON leave_stats.department = d.name
        LEFT JOIN (
          SELECT e.department, AVG(o.hours) as avg_hours
          FROM employees e
          LEFT JOIN overtime_applications o ON o.employeeId = e.employeeId
            AND ${overtimeDateFilter}
          GROUP BY e.department
        ) overtime_stats ON overtime_stats.department = d.name
        GROUP BY d.name`,
        [...rangeParams, ...rangeParams]
      );
      res.json(fallbackRows);
    } catch (fallbackError) {
      console.error('Error fetching department attendance:', fallbackError);
      res.status(500).json({ error: '獲取部門出勤率失敗', detail: fallbackError.message });
    }
  }
});

// 請假分布統計：正式數位化請假申請（leave_applications）與外部系統匯入的歷史
// 請假紀錄（imported_leave_records）合併統計，讓匯入資料還沒有的期間也能對得上
// 正式申請的數字。imported_leave_records 表可能因為 migration 009 還沒套用而
// 不存在，這裡失敗時退回只統計正式申請的版本，避免整個報表打不開
api.get('/dashboard/leaves', requireRole(...STAFF_ROLES), async (req, res) => {
  const { startDate, endDate } = req.query;
  const useRange = startDate && endDate;
  const rangeParams = useRange ? [startDate, endDate] : [];
  try {
    let rows;
    try {
      [rows] = await pool.execute(
        `SELECT name, SUM(value) as value FROM (
          SELECT lt.name as name, la.days as value, la.startDate as eventDate
          FROM leave_applications la
          LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
          UNION ALL
          SELECT ilr.leaveType as name, IFNULL(ilr.days, IFNULL(ilr.hours, ilr.minutes / 60) / 8) as value, DATE(ilr.startDateTime) as eventDate
          FROM imported_leave_records ilr
          WHERE ilr.status = '已生效'
        ) combined
        WHERE ${useRange
          ? 'eventDate >= ? AND eventDate <= ?'
          : 'MONTH(eventDate) = MONTH(CURRENT_DATE()) AND YEAR(eventDate) = YEAR(CURRENT_DATE())'}
        GROUP BY name`,
        rangeParams
      );
    } catch (unionError) {
      console.error('imported_leave_records 查詢失敗，改用只含正式申請的版本（可能尚未套用 migration 009）：', unionError.message);
      [rows] = await pool.execute(
        `SELECT lt.name as name, SUM(la.days) as value
         FROM leave_applications la
         LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
         WHERE ${useRange
           ? 'la.startDate >= ? AND la.startDate <= ?'
           : 'MONTH(la.startDate) = MONTH(CURRENT_DATE()) AND YEAR(la.startDate) = YEAR(CURRENT_DATE())'}
         GROUP BY la.leaveTypeId`,
        rangeParams
      );
    }
    const colorList = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4", "#6b7280"];
    const leaveData = rows.map((row, idx) => ({ ...row, color: colorList[idx % colorList.length] }));
    res.json(leaveData);
  } catch (error) {
    console.error('Error fetching leave distribution:', error);
    res.status(500).json({ error: '獲取請假分布失敗', detail: error.message });
  }
});

// 點選請假分布圖某一假別後的明細：哪些員工在該期間請了這個假別，合併正式申請
// 與已生效的匯入紀錄兩個來源，依請假開始日期新到舊排序
api.get('/dashboard/leaves/detail', requireRole(...STAFF_ROLES), async (req, res) => {
  const { name, startDate, endDate } = req.query;
  if (!name) {
    return res.status(400).json({ error: '請提供假別名稱' });
  }
  const useRange = startDate && endDate;
  const rangeFilter = useRange
    ? 'eventDate >= ? AND eventDate <= ?'
    : 'MONTH(eventDate) = MONTH(CURRENT_DATE()) AND YEAR(eventDate) = YEAR(CURRENT_DATE())';
  const rangeParams = useRange ? [startDate, endDate] : [];
  try {
    let rows;
    try {
      [rows] = await pool.execute(
        `SELECT * FROM (
          SELECT e.employeeId, e.name as employeeName, e.department,
            la.startDate as eventDate, la.endDate as endDate, la.days as value, 'application' as source
          FROM leave_applications la
          LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
          LEFT JOIN employees e ON la.employeeId = e.employeeId
          WHERE lt.name = ?
          UNION ALL
          SELECT e.employeeId, e.name as employeeName, e.department,
            DATE(ilr.startDateTime) as eventDate, DATE(ilr.endDateTime) as endDate,
            IFNULL(ilr.days, IFNULL(ilr.hours, ilr.minutes / 60) / 8) as value, 'imported' as source
          FROM imported_leave_records ilr
          LEFT JOIN employees e ON ilr.employeeId = e.employeeId
          WHERE ilr.leaveType = ? AND ilr.status = '已生效'
        ) combined
        WHERE ${rangeFilter}
        ORDER BY eventDate DESC`,
        [name, name, ...rangeParams]
      );
    } catch (unionError) {
      console.error('imported_leave_records 查詢失敗，改用只含正式申請的版本（可能尚未套用 migration 009）：', unionError.message);
      [rows] = await pool.execute(
        `SELECT e.employeeId, e.name as employeeName, e.department,
          la.startDate as eventDate, la.endDate as endDate, la.days as value, 'application' as source
        FROM leave_applications la
        LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
        LEFT JOIN employees e ON la.employeeId = e.employeeId
        WHERE lt.name = ? AND ${useRange
          ? 'la.startDate >= ? AND la.startDate <= ?'
          : 'MONTH(la.startDate) = MONTH(CURRENT_DATE()) AND YEAR(la.startDate) = YEAR(CURRENT_DATE())'}
        ORDER BY la.startDate DESC`,
        [name, ...rangeParams]
      );
    }
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave distribution detail:', error);
    res.status(500).json({ error: '獲取請假明細失敗', detail: error.message });
  }
});

app.use('/api', api);

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '伺服器內部錯誤', detail: err.message });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({ error: '找不到請求的資源', path: req.originalUrl });
});

// 補休到期提醒：每天檢查一次，找出「距離到期日剛好還有 14 天」且尚未休完的
// 補休額度，發一則通知給 HR/主管（走「系統設定」裡設定的通知通道），提醒
// 提早安排員工排休，避免逾期後才發現只能被動折算加班費。
// 已知限制：這是簡單的「整天比對」，若伺服器在那一天沒有在跑（例如剛好當天
// 重啟後才啟動），會錯過那筆額度的提醒；也沒有防重複機制，同一天內若伺服器
// 重啟多次可能會重複發送同一批提醒。以本系統的使用情境（單一 HR 團隊、不要求
// 100% 送達保證）這個簡化是可接受的
const COMP_TIME_REMINDER_DAYS_BEFORE = 14;

async function checkCompTimeExpiryReminders() {
  try {
    const [rows] = await pool.execute(
      `SELECT ctg.hours, ctg.usedHours, ctg.deadline, e.name as employee, e.employeeId
       FROM comp_time_grants ctg
       LEFT JOIN employees e ON ctg.employeeId = e.employeeId
       WHERE ctg.settledAt IS NULL AND ctg.hours > ctg.usedHours
         AND ctg.deadline = CURDATE() + INTERVAL ? DAY`,
      [COMP_TIME_REMINDER_DAYS_BEFORE]
    );
    if (rows.length === 0) return;

    const lines = rows.map(
      (row) => `${row.employee}（${row.employeeId}）：剩餘 ${(row.hours - row.usedHours).toFixed(1)} 小時，應休畢期限 ${row.deadline}`
    );
    await sendNotification(
      pool,
      '補休即將到期提醒',
      `以下員工的補休將於 ${COMP_TIME_REMINDER_DAYS_BEFORE} 天後到期，請提醒排休，逾期未休完將自動折算加班費：\n${lines.join('\n')}`
    );
  } catch (error) {
    console.error('補休到期提醒檢查失敗（可能尚未套用 migration 005）：', error.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 HRMS API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('⚠️  請確保 MariaDB 資料庫已運行並且 .env 連接設定正確');

  checkCompTimeExpiryReminders();
  setInterval(checkCompTimeExpiryReminders, 24 * 60 * 60 * 1000);
});
