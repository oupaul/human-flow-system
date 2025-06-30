
// 這是一個範例 Node.js API 伺服器檔案
// 您需要在您的 MariaDB 伺服器上執行此檔案

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

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
    
    const [result] = await pool.execute(
      'INSERT INTO departments (name, leadName, parentId, description, employeeCount) VALUES (?, ?, ?, ?, 0)',
      [name, leadName, parentId || null, description || '']
    );
    
    // 獲取新建立的部門資料
    const [newDept] = await pool.execute(
      'SELECT * FROM departments WHERE id = ?',
      [result.insertId]
    );
    
    res.json(newDept[0]);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: '新增部門失敗' });
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
    
    const [result] = await pool.execute(
      'INSERT INTO employees (name, employeeId, department, position, email, phone, joinDate, active, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, employeeId, department, position, email, phone, joinDate, active, address || '', notes || '']
    );
    
    // 獲取新建立的員工資料
    const [newEmployee] = await pool.execute(
      'SELECT * FROM employees WHERE id = ?',
      [result.insertId]
    );
    
    res.json(newEmployee[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: '新增員工失敗' });
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

// Dashboard API 路由

// 獲取統計資料
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 總員工數
    const [totalEmployees] = await pool.execute('SELECT COUNT(*) as count FROM employees WHERE active = true');
    
    // 本月請假數 (模擬資料，您需要根據實際的請假表結構調整)
    const monthlyLeaves = 28; // 暫時使用固定值
    
    // 平均出勤率 (模擬資料)
    const averageAttendance = 92; // 暫時使用固定值
    
    // 待審核申請 (模擬資料)
    const pendingRequests = 7; // 暫時使用固定值
    
    res.json({
      totalEmployees: totalEmployees[0].count,
      monthlyLeaves,
      averageAttendance,
      pendingRequests
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: '獲取統計資料失敗' });
  }
});

// 獲取部門出勤率
app.get('/api/dashboard/attendance', async (req, res) => {
  try {
    // 這裡使用模擬資料，您需要根據實際的出勤表結構調整
    const attendanceData = [
      { name: "IT部門", attendance: 95 },
      { name: "行銷部門", attendance: 88 },
      { name: "人資部門", attendance: 92 },
      { name: "財務部門", attendance: 90 },
      { name: "業務部門", attendance: 85 },
    ];
    
    res.json(attendanceData);
  } catch (error) {
    console.error('Error fetching department attendance:', error);
    res.status(500).json({ error: '獲取部門出勤率失敗' });
  }
});

// 獲取請假分布
app.get('/api/dashboard/leaves', async (req, res) => {
  try {
    // 這裡使用模擬資料，您需要根據實際的請假表結構調整
    const leaveData = [
      { name: "特休", value: 35, color: "#3b82f6" },
      { name: "事假", value: 15, color: "#f59e0b" },
      { name: "病假", value: 10, color: "#ef4444" },
      { name: "婚假", value: 5, color: "#10b981" },
      { name: "公假", value: 5, color: "#8b5cf6" },
    ];
    
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
