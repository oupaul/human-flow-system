import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
const PORT = 3001;

// 中介軟體
app.use(cors());
app.use(express.json());

// 資料庫連接配置
const pool = mysql.createPool({
  host: 'localhost',
  user: 'hrms_user',       // 請根據您的實際配置修改
  password: 'your_secure_password',  // 請根據您的實際配置修改
  database: 'hrms_database',        // 請根據您的實際配置修改
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 健康檢查端點
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date(),
    message: 'HRMS API Server is running'
  });
});

// 部門 API
app.get('/api/departments', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM departments ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: '獲取部門資料失敗', detail: error.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const { name, lead_name, parent_id, description } = req.body;
    if (!name || !lead_name) {
      return res.status(400).json({ error: '部門名稱與主管為必填' });
    }
    const [result] = await pool.execute(
      'INSERT INTO departments (name, lead_name, parent_id, description) VALUES (?, ?, ?, ?)',
      [name, lead_name, parent_id || null, description || null]
    );
    const [newDept] = await pool.execute('SELECT * FROM departments WHERE id = ?', [result.insertId]);
    res.json(newDept[0]);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: '新增部門失敗', detail: error.message });
  }
});

// 員工 API
app.get('/api/employees', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM employees ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: '獲取員工資料失敗', detail: error.message });
  }
});

// Dashboard API
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 總員工數
    const [totalEmployees] = await pool.execute('SELECT COUNT(*) as count FROM employees WHERE active = true');
    // 本月請假數（模擬數據）
    const monthlyLeaves = Math.floor(Math.random() * 50) + 10;
    // 平均出勤率（模擬數據）
    const averageAttendance = Math.floor(Math.random() * 10) + 90;
    // 待審核申請（模擬數據）
    const pendingRequests = Math.floor(Math.random() * 20) + 5;
    
    res.json({
      totalEmployees: totalEmployees[0].count,
      monthlyLeaves: monthlyLeaves,
      averageAttendance: averageAttendance,
      pendingRequests: pendingRequests
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: '獲取統計資料失敗', detail: error.message });
  }
});

app.get('/api/dashboard/attendance', async (req, res) => {
  try {
    // 模擬部門出勤資料
    const mockData = [
      { name: "資訊部", attendance: 95, leave: 3, overtime: 12 },
      { name: "人事部", attendance: 98, leave: 1, overtime: 5 },
      { name: "財務部", attendance: 92, leave: 5, overtime: 8 },
      { name: "行銷部", attendance: 88, leave: 8, overtime: 15 }
    ];
    res.json(mockData);
  } catch (error) {
    console.error('Error fetching department attendance:', error);
    res.status(500).json({ error: '獲取部門出勤率失敗', detail: error.message });
  }
});

app.get('/api/dashboard/leaves', async (req, res) => {
  try {
    // 模擬請假分布資料
    const mockData = [
      { name: "特休", value: 25, color: "#3b82f6" },
      { name: "事假", value: 15, color: "#f59e0b" },
      { name: "病假", value: 20, color: "#ef4444" },
      { name: "婚假", value: 5, color: "#10b981" },
      { name: "公假", value: 10, color: "#8b5cf6" }
    ];
    res.json(mockData);
  } catch (error) {
    console.error('Error fetching leave distribution:', error);
    res.status(500).json({ error: '獲取請假分布失敗', detail: error.message });
  }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '伺服器內部錯誤', detail: err.message });
});

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({ error: '找不到請求的資源', path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log(`🚀 HRMS API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('⚠️  請確保 MariaDB 資料庫已運行並且連接配置正確');
});