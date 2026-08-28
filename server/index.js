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
  const { name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary, initialAnnualLeaveUsed } = data;
  if (!name || !employeeId || !department || !position || !email || !joinDate) {
    throw new Error('所有必填欄位皆需填寫（姓名、員工編號、部門、職位、電子郵件、到職日）');
  }

  const [result] = await pool.execute(
    'INSERT INTO employees (name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, employeeId, department, position, email, phone || null, joinDate, active !== undefined ? active : true, address || null, notes || null, monthlySalary || null]
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
    initialAnnualLeaveUsed: findColumn(['已用特休', '特休已用']),
  };

  if (columns.name === -1 || columns.employeeId === -1 || columns.department === -1 ||
      columns.position === -1 || columns.email === -1 || columns.joinDate === -1) {
    throw new Error('CSV 標題列需包含：姓名、員工編號、部門、職位、電子郵件、到職日');
  }

  const normalizeDate = (raw) => (raw ? raw.replace(/\//g, '-') : '');
  const pick = (cells, key) => (columns[key] === -1 ? '' : (cells[columns[key]] || ''));

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
      `SELECT u.*, e.name as employeeName FROM users u
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
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: '登入失敗', detail: error.message });
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
      `SELECT u.id, u.username, u.role, u.employee_id, e.name as employeeName
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

    await pool.execute(
      'UPDATE departments SET name = ?, leadName = ?, parentId = ?, description = ? WHERE id = ?',
      [name, leadName, parentId || null, description || '', id]
    );

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
    const { name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary } = req.body;

    const [beforeRows] = await pool.execute('SELECT employeeId FROM employees WHERE id = ?', [id]);
    const previousEmployeeId = beforeRows[0]?.employeeId;

    await pool.execute(
      'UPDATE employees SET name = ?, employeeId = ?, department = ?, position = ?, email = ?, phone = ?, joinDate = ?, active = ?, address = ?, notes = ?, monthlySalary = ? WHERE id = ?',
      [name, employeeId, department, position, email, phone, joinDate, active, address || '', notes || '', monthlySalary || null, id]
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

    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

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
    sendNotification(
      pool,
      '新的請假申請待審核',
      `${application.employee}（${application.employeeId}）提交了一筆${application.type}申請（${application.startDate} ~ ${application.endDate}，共 ${application.days} 天），請至系統審核。`
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
// 可用天數＝本期發放＋上期遞延，已用天數＝本期已核准的特休申請累計
api.get('/leave-balances', async (req, res) => {
  try {
    // employee 角色只能看到自己的假別餘額
    const isEmployee = req.user.role === 'employee';
    const [rows] = await pool.execute(`
      SELECT
        lb.id, lb.employeeId, lb.sickLeave, lb.sickLeaveUsed, lb.compensatoryLeave, lb.compensatoryLeaveUsed, lb.updated_at,
        e.name as employee,
        lp.id as activePeriodId,
        IFNULL(lp.grantedDays + lp.carriedInDays, 0) as annualLeave,
        IFNULL(lp.usedDays, 0) as annualLeaveUsed
      FROM leave_balances lb
      LEFT JOIN employees e ON lb.employeeId = e.employeeId
      LEFT JOIN leave_periods lp ON lp.id = (
        SELECT id FROM leave_periods lp2
        WHERE lp2.employeeId = lb.employeeId AND lp2.settledAt IS NULL
        ORDER BY lp2.periodStart DESC LIMIT 1
      )
      ${isEmployee ? 'WHERE lb.employeeId = ?' : ''}
      ORDER BY lb.employeeId
    `, isEmployee ? [req.user.employeeId] : []);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    res.status(500).json({ error: '獲取假別餘額失敗', detail: error.message });
  }
});

api.put('/leave-balances/:employeeId', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { sickLeave, sickLeaveUsed, compensatoryLeave, compensatoryLeaveUsed } = req.body;

    await pool.execute(
      'UPDATE leave_balances SET sickLeave = ?, sickLeaveUsed = ?, compensatoryLeave = ?, compensatoryLeaveUsed = ? WHERE employeeId = ?',
      [sickLeave, sickLeaveUsed, compensatoryLeave, compensatoryLeaveUsed, employeeId]
    );

    const [updatedBalance] = await pool.execute(`
      SELECT
        lb.id, lb.employeeId, lb.sickLeave, lb.sickLeaveUsed, lb.compensatoryLeave, lb.compensatoryLeaveUsed, lb.updated_at,
        e.name as employee,
        lp.id as activePeriodId,
        IFNULL(lp.grantedDays + lp.carriedInDays, 0) as annualLeave,
        IFNULL(lp.usedDays, 0) as annualLeaveUsed
      FROM leave_balances lb
      LEFT JOIN employees e ON lb.employeeId = e.employeeId
      LEFT JOIN leave_periods lp ON lp.id = (
        SELECT id FROM leave_periods lp2
        WHERE lp2.employeeId = lb.employeeId AND lp2.settledAt IS NULL
        ORDER BY lp2.periodStart DESC LIMIT 1
      )
      WHERE lb.employeeId = ?
    `, [employeeId]);

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
    const { date, startTime, endTime, reason } = req.body;
    if (!employeeId || !date || !startTime || !endTime || !reason) {
      return res.status(400).json({ error: '所有必填欄位皆需填寫' });
    }

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (!(hours > 0)) {
      return res.status(400).json({ error: '結束時間必須晚於開始時間' });
    }

    const [holidayRows] = await pool.execute('SELECT isHoliday FROM holidays WHERE date = ?', [date]);
    const dayOfWeek = new Date(date).getUTCDay();
    const onHoliday = holidayRows.length > 0
      ? Boolean(holidayRows[0].isHoliday)
      : (dayOfWeek === 0 || dayOfWeek === 6);

    const [result] = await pool.execute(
      'INSERT INTO overtime_applications (employeeId, date, startTime, endTime, hours, reason, onHoliday, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, date, startTime, endTime, hours, reason, onHoliday, 'pending']
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

    await pool.execute(
      'UPDATE overtime_applications SET status = ?, approver = ?, reviewNote = ? WHERE id = ?',
      [status, approver, reviewNote || null, id]
    );

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

// Dashboard API 路由

api.get('/dashboard/stats', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [totalEmployees] = await pool.execute('SELECT COUNT(*) as count FROM employees WHERE active = true');
    const [monthlyLeaves] = await pool.execute(`
      SELECT COUNT(*) as count FROM leave_applications
      WHERE MONTH(startDate) = MONTH(CURRENT_DATE()) AND YEAR(startDate) = YEAR(CURRENT_DATE())
    `);

    let averageAttendance = null;
    try {
      const [attendanceRows] = await pool.execute(`
        SELECT AVG(attendance) as avgAttendance FROM attendance
        WHERE MONTH(date) = MONTH(CURRENT_DATE()) AND YEAR(date) = YEAR(CURRENT_DATE())
      `);
      averageAttendance = attendanceRows[0]?.avgAttendance ? Math.round(attendanceRows[0].avgAttendance) : null;
    } catch (e) {
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

// 注意：系統目前沒有出勤打卡資料表，attendance 固定回傳 0；
// leave（本月請假件數）與 overtime（本月平均加班時數）則查詢真實資料
api.get('/dashboard/attendance', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.name as name,
        0 as attendance,
        IFNULL(leave_stats.leave_count, 0) as \`leave\`,
        IFNULL(overtime_stats.avg_hours, 0) as overtime
      FROM departments d
      LEFT JOIN (
        SELECT e.department, COUNT(la.id) as leave_count
        FROM employees e
        LEFT JOIN leave_applications la ON la.employeeId = e.employeeId
          AND MONTH(la.startDate) = MONTH(CURRENT_DATE()) AND YEAR(la.startDate) = YEAR(CURRENT_DATE())
        GROUP BY e.department
      ) leave_stats ON leave_stats.department = d.name
      LEFT JOIN (
        SELECT e.department, AVG(o.hours) as avg_hours
        FROM employees e
        LEFT JOIN overtime_applications o ON o.employeeId = e.employeeId
          AND MONTH(o.date) = MONTH(CURRENT_DATE()) AND YEAR(o.date) = YEAR(CURRENT_DATE())
        GROUP BY e.department
      ) overtime_stats ON overtime_stats.department = d.name
      GROUP BY d.name
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching department attendance:', error);
    res.status(500).json({ error: '獲取部門出勤率失敗', detail: error.message });
  }
});

api.get('/dashboard/leaves', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT lt.name as name, SUM(la.days) as value
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      WHERE MONTH(la.startDate) = MONTH(CURRENT_DATE()) AND YEAR(la.startDate) = YEAR(CURRENT_DATE())
      GROUP BY la.leaveTypeId
    `);
    const colorList = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4", "#6b7280"];
    const leaveData = rows.map((row, idx) => ({ ...row, color: colorList[idx % colorList.length] }));
    res.json(leaveData);
  } catch (error) {
    console.error('Error fetching leave distribution:', error);
    res.status(500).json({ error: '獲取請假分布失敗', detail: error.message });
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

app.listen(PORT, () => {
  console.log(`🚀 HRMS API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('⚠️  請確保 MariaDB 資料庫已運行並且 .env 連接設定正確');
});
