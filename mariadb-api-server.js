// 這是一個範例 Node.js API 伺服器檔案
// 您需要在您的 MariaDB 伺服器上執行此檔案

import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
const PORT = 3001;

// 中介軟體
app.use(cors());
app.use(express.json());

// 資料庫連接配置
const dbConfig = {
  host: 'localhost',
  user: 'your_username',        // 請替換為您的 MariaDB 使用者名稱
  password: 'your_password',    // 請替換為您的 MariaDB 密碼
  database: 'your_database',    // 請替換為您的資料庫名稱
  port: 3306
};

// 建立資料庫連接池
const pool = mysql.createPool(dbConfig);

// 部門 API 路由 (保持原有功能)

// 獲取所有部門
app.get('/api/departments', async (req, res) => {
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
    res.status(500).json({ error: '獲取部門資料失敗' });
  }
});

// 新增部門
app.post('/api/departments', async (req, res) => {
  try {
    const { name, leadName, parentId, description } = req.body;
    if (!name || !leadName) {
      return res.status(400).json({ error: '部門名稱與主管名稱為必填' });
    }
    const [result] = await pool.execute(
      'INSERT INTO departments (name, leadName, parentId, description, employeeCount) VALUES (?, ?, ?, ?, 0)',
      [name, leadName, parentId ? parentId : null, description ? description : null]
    );
    const [newDept] = await pool.execute(
      'SELECT * FROM departments WHERE id = ?',
      [result.insertId]
    );
    res.json(newDept[0]);
  } catch (error) {
    console.error('Error creating department:', error.message, error);
    res.status(500).json({ error: '新增部門失敗', detail: error.message });
  }
});

// 更新部門
app.put('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, leadName, parentId, description } = req.body;
    
    await pool.execute(
      'UPDATE departments SET name = ?, leadName = ?, parentId = ?, description = ? WHERE id = ?',
      [name, leadName, parentId || null, description || '', id]
    );
    
    // 獲取更新後的部門資料
    const [updatedDept] = await pool.execute(
      'SELECT * FROM departments WHERE id = ?',
      [id]
    );
    
    res.json(updatedDept[0]);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: '更新部門失敗' });
  }
});

// 刪除部門
app.delete('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    
    res.json({ message: '部門刪除成功' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: '刪除部門失敗' });
  }
});

// 員工 API 路由

// 獲取所有員工
app.get('/api/employees', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT * FROM employees ORDER BY id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: '獲取員工資料失敗' });
  }
});

// 新增員工
app.post('/api/employees', async (req, res) => {
  try {
    const { name, employeeId, department, position, email, phone, joinDate, active, address, notes } = req.body;
    if (!name || !employeeId || !department || !position || !email || !joinDate) {
      return res.status(400).json({ error: '所有必填欄位皆需填寫' });
    }
    const [result] = await pool.execute(
      'INSERT INTO employees (name, employeeId, department, position, email, phone, joinDate, active, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, employeeId, department, position, email, phone || null, joinDate, active !== undefined ? active : true, address || null, notes || null]
    );
    const [newEmployee] = await pool.execute(
      'SELECT * FROM employees WHERE id = ?',
      [result.insertId]
    );
    res.json(newEmployee[0]);
  } catch (error) {
    console.error('Error creating employee:', error.message, error);
    res.status(500).json({ error: '新增員工失敗', detail: error.message });
  }
});

// 更新員工
app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, employeeId, department, position, email, phone, joinDate, active, address, notes } = req.body;
    
    await pool.execute(
      'UPDATE employees SET name = ?, employeeId = ?, department = ?, position = ?, email = ?, phone = ?, joinDate = ?, active = ?, address = ?, notes = ? WHERE id = ?',
      [name, employeeId, department, position, email, phone, joinDate, active, address || '', notes || '', id]
    );
    
    // 獲取更新後的員工資料
    const [updatedEmployee] = await pool.execute(
      'SELECT * FROM employees WHERE id = ?',
      [id]
    );
    
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: '更新員工失敗' });
  }
});

// 刪除員工
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
    
    res.json({ message: '員工刪除成功' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: '刪除員工失敗' });
  }
});

// 員工離職
app.put('/api/employees/:id/terminate', async (req, res) => {
  try {
    const { id } = req.params;
    const { terminationDate, terminationReason } = req.body;
    
    await pool.execute(
      'UPDATE employees SET active = false, terminationDate = ?, terminationReason = ? WHERE id = ?',
      [terminationDate, terminationReason, id]
    );
    
    // 獲取更新後的員工資料
    const [updatedEmployee] = await pool.execute(
      'SELECT * FROM employees WHERE id = ?',
      [id]
    );
    
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error terminating employee:', error);
    res.status(500).json({ error: '員工離職失敗' });
  }
});

// 假別類型 API 路由

// 獲取所有假別類型
app.get('/api/leave-types', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT * FROM leave_types ORDER BY id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ error: '獲取假別類型失敗' });
  }
});

// 新增假別類型
app.post('/api/leave-types', async (req, res) => {
  try {
    const { name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO leave_types (name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit]
    );
    
    const [newLeaveType] = await pool.execute(
      'SELECT * FROM leave_types WHERE id = ?',
      [result.insertId]
    );
    
    res.json(newLeaveType[0]);
  } catch (error) {
    console.error('Error creating leave type:', error);
    res.status(500).json({ error: '新增假別類型失敗' });
  }
});

// 請假申請 API 路由

// 獲取所有請假申請
app.get('/api/leave-applications', async (req, res) => {
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
    res.status(500).json({ error: '獲取請假申請失敗' });
  }
});

// 新增請假申請
app.post('/api/leave-applications', async (req, res) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, startTime, endTime, unit, reason, deputy } = req.body;
    
    // 計算請假天數（簡化版）
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
    res.status(500).json({ error: '新增請假申請失敗' });
  }
});

// 更新請假申請狀態
app.put('/api/leave-applications/:id/status', async (req, res) => {
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
    res.status(500).json({ error: '更新請假申請狀態失敗' });
  }
});

// 假別餘額 API 路由

// 獲取所有假別餘額
app.get('/api/leave-balances', async (req, res) => {
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
    res.status(500).json({ error: '獲取假別餘額失敗' });
  }
});

// 更新假別餘額
app.put('/api/leave-balances/:employeeId', async (req, res) => {
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
    res.status(500).json({ error: '更新假別餘額失敗' });
  }
});

// Dashboard API 路由

// 獲取統計資料
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 總員工數
    const [totalEmployees] = await pool.execute('SELECT COUNT(*) as count FROM employees WHERE active = true');
    // 本月請假數
    const [monthlyLeaves] = await pool.execute(`
      SELECT COUNT(*) as count FROM leave_applications 
      WHERE MONTH(startDate) = MONTH(CURRENT_DATE()) AND YEAR(startDate) = YEAR(CURRENT_DATE())
    `);
    // 平均出勤率（假設 attendance 表有出勤率欄位）
    let averageAttendance = null;
    try {
      const [attendanceRows] = await pool.execute(`SELECT AVG(attendance) as avgAttendance FROM attendance WHERE MONTH(date) = MONTH(CURRENT_DATE()) AND YEAR(date) = YEAR(CURRENT_DATE())`);
      averageAttendance = attendanceRows[0]?.avgAttendance ? Math.round(attendanceRows[0].avgAttendance) : null;
    } catch (e) {
      averageAttendance = null;
    }
    // 待審核申請
    const [pendingRequests] = await pool.execute(`SELECT COUNT(*) as count FROM leave_applications WHERE status = 'pending'`);
    res.json({
      totalEmployees: totalEmployees[0].count,
      monthlyLeaves: monthlyLeaves[0].count,
      averageAttendance: averageAttendance,
      pendingRequests: pendingRequests[0].count
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: '獲取統計資料失敗' });
  }
});

// 獲取部門出勤率
app.get('/api/dashboard/attendance', async (req, res) => {
  try {
    // 改為查詢資料庫取得部門出勤、請假、加班資料
    const [rows] = await pool.execute(`
      SELECT 
        d.name as name,
        IFNULL(AVG(a.attendance), 0) as attendance,
        IFNULL(AVG(l.leave_rate), 0) as leave,
        0 as overtime -- 若有加班資料表可替換
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
    res.status(500).json({ error: '獲取部門出勤率失敗' });
  }
});

// 獲取請假分布
app.get('/api/dashboard/leaves', async (req, res) => {
  try {
    // 依假別類型統計本月請假天數
    const [rows] = await pool.execute(`
      SELECT lt.name as name, SUM(la.days) as value
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leaveTypeId = lt.id
      WHERE MONTH(la.startDate) = MONTH(CURRENT_DATE()) AND YEAR(la.startDate) = YEAR(CURRENT_DATE())
      GROUP BY la.leaveTypeId
    `);
    // 可選：加上顏色
    const colorList = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4", "#6b7280"];
    const leaveData = rows.map((row, idx) => ({ ...row, color: colorList[idx % colorList.length] }));
    res.json(leaveData);
  } catch (error) {
    console.error('Error fetching leave distribution:', error);
    res.status(500).json({ error: '獲取請假分布失敗' });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  console.log('請確保 MariaDB 資料庫已運行並且連接配置正確');
});

// 建立員工資料表的 SQL（如果需要的話）
/*
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  employeeId VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  joinDate DATE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  terminationDate DATE NULL,
  terminationReason TEXT NULL,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  leadName VARCHAR(255) NOT NULL,
  parentId INT DEFAULT NULL,
  employeeCount INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parentId) REFERENCES departments(id) ON DELETE SET NULL
);
*/

// 建立假別管理相關資料表的 SQL（如果需要的話）
/*
-- 假別類型表
CREATE TABLE IF NOT EXISTS leave_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  unit VARCHAR(50) NOT NULL,
  needProof BOOLEAN DEFAULT FALSE,
  affectAttendance BOOLEAN DEFAULT FALSE,
  isPaid BOOLEAN DEFAULT TRUE,
  maxDays VARCHAR(100),
  advanceApply VARCHAR(100),
  canSplit BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 請假申請表
CREATE TABLE IF NOT EXISTS leave_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  leaveTypeId INT NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  startTime TIME NULL,
  endTime TIME NULL,
  days DECIMAL(3,1) NOT NULL,
  reason TEXT NOT NULL,
  deputy VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approver VARCHAR(255) NULL,
  attachment VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);

-- 假別餘額表
CREATE TABLE IF NOT EXISTS leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL UNIQUE,
  annualLeave INT DEFAULT 0,
  annualLeaveUsed INT DEFAULT 0,
  sickLeave INT DEFAULT 30,
  sickLeaveUsed INT DEFAULT 0,
  compensatoryLeave INT DEFAULT 0,
  compensatoryLeaveUsed INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);

-- 插入範例假別類型
INSERT INTO leave_types (name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit) VALUES
('特休', 'AL', '天', FALSE, FALSE, TRUE, '依年資', '3天', TRUE),
('事假', 'PL', '小時', FALSE, TRUE, FALSE, '14天', '3天', TRUE),
('病假', 'SL', '天', TRUE, FALSE, FALSE, '30天', '當天', TRUE),
('婚假', 'ML', '天', TRUE, FALSE, TRUE, '8天', '7天', FALSE),
('公假', 'OL', '天', TRUE, FALSE, TRUE, '依需求', '3天', TRUE),
('喪假', 'BL', '天', TRUE, FALSE, TRUE, '依親屬關係', '當天', TRUE);

-- 插入範例請假申請
INSERT INTO leave_applications (employeeId, leaveTypeId, startDate, endDate, days, reason, status, approver) VALUES
('EMP001', 1, '2023-05-10', '2023-05-12', 3, '家庭旅遊', 'approved', '李主管'),
('EMP002', 3, '2023-05-15', '2023-05-15', 1, '感冒就醫', 'approved', '王主管'),
('EMP003', 2, '2023-05-18', '2023-05-18', 0.5, '個人事務', 'pending', ''),
('EMP004', 4, '2023-06-01', '2023-06-08', 8, '結婚', 'pending', ''),
('EMP005', 6, '2023-05-20', '2023-05-23', 4, '祖父過世', 'pending', '');

-- 插入範例假別餘額
INSERT INTO leave_balances (employeeId, annualLeave, annualLeaveUsed, sickLeave, sickLeaveUsed, compensatoryLeave, compensatoryLeaveUsed) VALUES
('EMP001', 10, 3, 30, 0, 2, 0),
('EMP002', 7, 0, 30, 1, 0, 0),
('EMP003', 14, 5, 30, 2, 1, 0),
('EMP004', 21, 10, 30, 4, 3, 2),
('EMP005', 3, 0, 30, 0, 0, 0);
*/
