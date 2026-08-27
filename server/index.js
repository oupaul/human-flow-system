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
  // TINYINT(1) 欄位（如 active、isPaid…）自動轉為 JS boolean，避免前端收到 0/1 數字
  typeCast: (field, next) => {
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1';
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
      'SELECT * FROM users WHERE username = ? AND active = TRUE',
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
      { sub: user.id, username: user.username, role: user.role },
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

// 以下路由皆須登入
const api = express.Router();
api.use(authMiddleware);

api.get('/auth/me', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, role, employee_id FROM users WHERE id = ?',
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
      },
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: '獲取使用者資料失敗', detail: error.message });
  }
});

// 部門 API 路由

api.get('/departments', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.*,
        parent.name as parentName
      FROM departments d
      LEFT JOIN departments parent ON d.parentId = parent.id
      ORDER BY d.parentId IS NULL DESC, d.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: '獲取部門資料失敗', detail: error.message });
  }
});

api.post('/departments', async (req, res) => {
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

api.put('/departments/:id', async (req, res) => {
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

api.delete('/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    res.json({ message: '部門刪除成功' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: '刪除部門失敗', detail: error.message });
  }
});

// 員工 API 路由

api.get('/employees', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM employees ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: '獲取員工資料失敗', detail: error.message });
  }
});

api.post('/employees', async (req, res) => {
  try {
    const { name, employeeId, department, position, email, phone, joinDate, active, address, notes } = req.body;
    if (!name || !employeeId || !department || !position || !email || !joinDate) {
      return res.status(400).json({ error: '所有必填欄位皆需填寫' });
    }
    const [result] = await pool.execute(
      'INSERT INTO employees (name, employeeId, department, position, email, phone, joinDate, active, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, employeeId, department, position, email, phone || null, joinDate, active !== undefined ? active : true, address || null, notes || null]
    );

    // 依到職日建立初始特休假別餘額
    const annualLeave = calculateAnnualLeaveDays(joinDate);
    await pool.execute(
      'INSERT INTO leave_balances (employeeId, annualLeave, annualLeaveUsed) VALUES (?, ?, 0)',
      [employeeId, annualLeave]
    );

    const [newEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [result.insertId]);
    res.json(newEmployee[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: '新增員工失敗', detail: error.message });
  }
});

api.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, employeeId, department, position, email, phone, joinDate, active, address, notes } = req.body;

    await pool.execute(
      'UPDATE employees SET name = ?, employeeId = ?, department = ?, position = ?, email = ?, phone = ?, joinDate = ?, active = ?, address = ?, notes = ? WHERE id = ?',
      [name, employeeId, department, position, email, phone, joinDate, active, address || '', notes || '', id]
    );

    const [updatedEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: '更新員工失敗', detail: error.message });
  }
});

api.delete('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ message: '員工刪除成功' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: '刪除員工失敗', detail: error.message });
  }
});

api.put('/employees/:id/terminate', async (req, res) => {
  try {
    const { id } = req.params;
    const { terminationDate, terminationReason } = req.body;

    await pool.execute(
      'UPDATE employees SET active = false, terminationDate = ?, terminationReason = ? WHERE id = ?',
      [terminationDate, terminationReason, id]
    );

    const [updatedEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error terminating employee:', error);
    res.status(500).json({ error: '員工離職失敗', detail: error.message });
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

api.post('/leave-types', async (req, res) => {
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
    const [rows] = await pool.execute(`
      SELECT
        la.*,
        e.name as employee,
        lt.name as type
      FROM leave_applications la
      LEFT JOIN employees e ON la.employeeId = e.employeeId
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      ORDER BY la.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave applications:', error);
    res.status(500).json({ error: '獲取請假申請失敗', detail: error.message });
  }
});

api.post('/leave-applications', async (req, res) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, startTime, endTime, reason, deputy } = req.body;

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

api.put('/leave-applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver } = req.body;

    await pool.execute(
      'UPDATE leave_applications SET status = ?, approver = ? WHERE id = ?',
      [status, approver, id]
    );

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

api.get('/leave-balances', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        lb.*,
        e.name as employee
      FROM leave_balances lb
      LEFT JOIN employees e ON lb.employeeId = e.employeeId
      ORDER BY lb.employeeId
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    res.status(500).json({ error: '獲取假別餘額失敗', detail: error.message });
  }
});

api.put('/leave-balances/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { annualLeave, annualLeaveUsed, sickLeave, sickLeaveUsed, compensatoryLeave, compensatoryLeaveUsed } = req.body;

    await pool.execute(
      'UPDATE leave_balances SET annualLeave = ?, annualLeaveUsed = ?, sickLeave = ?, sickLeaveUsed = ?, compensatoryLeave = ?, compensatoryLeaveUsed = ? WHERE employeeId = ?',
      [annualLeave, annualLeaveUsed, sickLeave, sickLeaveUsed, compensatoryLeave, compensatoryLeaveUsed, employeeId]
    );

    const [updatedBalance] = await pool.execute(`
      SELECT
        lb.*,
        e.name as employee
      FROM leave_balances lb
      LEFT JOIN employees e ON lb.employeeId = e.employeeId
      WHERE lb.employeeId = ?
    `, [employeeId]);

    res.json(updatedBalance[0]);
  } catch (error) {
    console.error('Error updating leave balance:', error);
    res.status(500).json({ error: '更新假別餘額失敗', detail: error.message });
  }
});

// 依所有在職員工的到職日重新計算特休天數（勞基法第 38 條），已使用天數維持不變
api.post('/leave-balances/recalculate', async (req, res) => {
  try {
    const [employees] = await pool.execute('SELECT employeeId, joinDate FROM employees WHERE active = TRUE');

    let updated = 0;
    for (const employee of employees) {
      const annualLeave = calculateAnnualLeaveDays(employee.joinDate);
      const [result] = await pool.execute(
        'UPDATE leave_balances SET annualLeave = ? WHERE employeeId = ?',
        [annualLeave, employee.employeeId]
      );
      if (result.affectedRows === 0) {
        await pool.execute(
          'INSERT INTO leave_balances (employeeId, annualLeave, annualLeaveUsed) VALUES (?, ?, 0)',
          [employee.employeeId, annualLeave]
        );
      }
      updated += 1;
    }

    res.json({ message: '特休天數已重新計算', updated });
  } catch (error) {
    console.error('Error recalculating annual leave:', error);
    res.status(500).json({ error: '重新計算特休天數失敗', detail: error.message });
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

api.post('/holidays', async (req, res) => {
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
api.post('/holidays/import', async (req, res) => {
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

api.delete('/holidays/:id', async (req, res) => {
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
    const [rows] = await pool.execute(`
      SELECT
        o.*,
        e.name as employee
      FROM overtime_applications o
      LEFT JOIN employees e ON o.employeeId = e.employeeId
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching overtime applications:', error);
    res.status(500).json({ error: '獲取加班申請失敗', detail: error.message });
  }
});

api.post('/overtime-applications', async (req, res) => {
  try {
    const { employeeId, date, startTime, endTime, reason } = req.body;
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

api.put('/overtime-applications/:id/status', async (req, res) => {
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

api.get('/dashboard/stats', async (req, res) => {
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

api.get('/dashboard/attendance', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.name as name,
        IFNULL(AVG(a.attendance), 0) as attendance,
        IFNULL(AVG(l.leave_rate), 0) as leave,
        0 as overtime
      FROM departments d
      LEFT JOIN attendance a ON a.department = d.name
      LEFT JOIN (
        SELECT department, AVG(leave_days/working_days)*100 as leave_rate
        FROM (
          SELECT e.department, COUNT(la.id) as leave_days, COUNT(DISTINCT a2.date) as working_days
          FROM employees e
          LEFT JOIN leave_applications la ON la.employeeId = e.employeeId
          LEFT JOIN attendance a2 ON a2.employeeId = e.employeeId
          GROUP BY e.department, e.employeeId
        ) t
        GROUP BY department
      ) l ON l.department = d.name
      GROUP BY d.name
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching department attendance:', error);
    res.status(500).json({ error: '獲取部門出勤率失敗', detail: error.message });
  }
});

api.get('/dashboard/leaves', async (req, res) => {
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
