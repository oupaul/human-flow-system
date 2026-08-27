import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

// 取得員工目前尚未結算的特休週年期間；若不存在（新員工）則建立第一期
async function getOrCreateActivePeriod(employeeId, joinDate) {
  const [rows] = await pool.execute(
    'SELECT * FROM leave_periods WHERE employeeId = ? AND settledAt IS NULL ORDER BY periodStart DESC LIMIT 1',
    [employeeId]
  );
  if (rows[0]) {
    return rows[0];
  }

  const periodEnd = addOneYear(joinDate);
  const grantedDays = computePeriodGrant(joinDate, periodEnd);

  const [result] = await pool.execute(
    'INSERT INTO leave_periods (employeeId, periodStart, periodEnd, grantedDays, carriedInDays, usedDays) VALUES (?, ?, ?, ?, 0, 0)',
    [employeeId, joinDate, periodEnd, grantedDays]
  );
  const [newRows] = await pool.execute('SELECT * FROM leave_periods WHERE id = ?', [result.insertId]);
  return newRows[0];
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
    const { name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary } = req.body;
    if (!name || !employeeId || !department || !position || !email || !joinDate) {
      return res.status(400).json({ error: '所有必填欄位皆需填寫' });
    }
    const [result] = await pool.execute(
      'INSERT INTO employees (name, employeeId, department, position, email, phone, joinDate, active, address, notes, monthlySalary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, employeeId, department, position, email, phone || null, joinDate, active !== undefined ? active : true, address || null, notes || null, monthlySalary || null]
    );

    // 建立第一期特休週年紀錄；病假/補休沿用 leave_balances 預設值
    await getOrCreateActivePeriod(employeeId, joinDate);
    await pool.execute('INSERT INTO leave_balances (employeeId) VALUES (?)', [employeeId]);

    // 自動建立員工登入帳號：帳號＝員工 email，預設密碼＝員工編號，登入後請自行修改密碼
    await syncEmployeeAccount(employeeId, email);

    const [newEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [result.insertId]);
    res.json(newEmployee[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: '新增員工失敗', detail: error.message });
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

    const [result] = await pool.execute(
      'INSERT INTO leave_applications (employeeId, leaveTypeId, startDate, endDate, startTime, endTime, days, reason, deputy, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, leaveTypeId, startDate, endDate, startTime || null, endTime || null, daysDiff, reason, deputy || null, 'pending']
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

    res.json(newApplication[0]);
  } catch (error) {
    console.error('Error creating leave application:', error);
    res.status(500).json({ error: '新增請假申請失敗', detail: error.message });
  }
});

api.put('/leave-applications/:id/status', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver } = req.body;

    const [beforeRows] = await pool.execute(`
      SELECT la.employeeId, la.days, la.status as previousStatus, lt.code as leaveTypeCode, e.joinDate
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      LEFT JOIN employees e ON la.employeeId = e.employeeId
      WHERE la.id = ?
    `, [id]);
    const application = beforeRows[0];

    await pool.execute(
      'UPDATE leave_applications SET status = ?, approver = ? WHERE id = ?',
      [status, approver, id]
    );

    // 特休申請核准時計入目前週年期間的已用天數；若從已核准改回其他狀態則退回
    if (application && application.leaveTypeCode === 'AL' && application.joinDate) {
      if (status === 'approved' && application.previousStatus !== 'approved') {
        const period = await getOrCreateActivePeriod(application.employeeId, application.joinDate);
        await pool.execute('UPDATE leave_periods SET usedDays = usedDays + ? WHERE id = ?', [application.days, period.id]);
      } else if (status !== 'approved' && application.previousStatus === 'approved') {
        const period = await getOrCreateActivePeriod(application.employeeId, application.joinDate);
        await pool.execute('UPDATE leave_periods SET usedDays = GREATEST(0, usedDays - ?) WHERE id = ?', [application.days, period.id]);
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

    res.json(newApplication[0]);
  } catch (error) {
    console.error('Error creating overtime application:', error);
    res.status(500).json({ error: '新增加班申請失敗', detail: error.message });
  }
});

api.put('/overtime-applications/:id/status', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver } = req.body;

    await pool.execute(
      'UPDATE overtime_applications SET status = ?, approver = ? WHERE id = ?',
      [status, approver, id]
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

    const [pendingRequests] = await pool.execute(`SELECT COUNT(*) as count FROM leave_applications WHERE status = 'pending'`);

    res.json({
      totalEmployees: totalEmployees[0].count,
      monthlyLeaves: monthlyLeaves[0].count,
      averageAttendance,
      pendingRequests: pendingRequests[0].count,
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
