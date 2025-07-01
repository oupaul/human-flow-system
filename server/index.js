import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: 'localhost',
  user: 'hrms_user',
  password: 'your_secure_password',
  database: 'hrms_database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 取得所有部門
app.get('/api/departments', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM departments');
  res.json(rows);
});
// 新增部門
app.post('/api/departments', async (req, res) => {
  const { name, lead_name, parent_id, description } = req.body;
  if (!name || !lead_name) return res.status(400).json({ error: '部門名稱與主管為必填' });
  const [result] = await pool.execute(
    'INSERT INTO departments (name, lead_name, parent_id, description) VALUES (?, ?, ?, ?)',
    [name, lead_name, parent_id || null, description || null]
  );
  const [newDept] = await pool.execute('SELECT * FROM departments WHERE id = ?', [result.insertId]);
  res.json(newDept[0]);
});
// 取得所有員工
app.get('/api/employees', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM employees');
  res.json(rows);
});
// 新增員工
app.post('/api/employees', async (req, res) => {
  const { name, employee_id, department, position, email, phone, join_date, active, address, notes } = req.body;
  if (!name || !employee_id || !department || !position || !email || !join_date) {
    return res.status(400).json({ error: '所有必填欄位皆需填寫' });
  }
  const [result] = await pool.execute(
    'INSERT INTO employees (name, employee_id, department, position, email, phone, join_date, active, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, employee_id, department, position, email, phone || null, join_date, active !== undefined ? active : true, address || null, notes || null]
  );
  const [newEmployee] = await pool.execute('SELECT * FROM employees WHERE id = ?', [result.insertId]);
  res.json(newEmployee[0]);
});
// 取得所有請假申請
app.get('/api/leave-requests', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM leave_requests');
  res.json(rows);
});
// 新增請假申請
app.post('/api/leave-requests', async (req, res) => {
  const { employee_id, employee_name, leave_type, start_date, end_date, days_requested, reason } = req.body;
  if (!employee_id || !employee_name || !leave_type || !start_date || !end_date || !days_requested) {
    return res.status(400).json({ error: '所有必填欄位皆需填寫' });
  }
  const [result] = await pool.execute(
    'INSERT INTO leave_requests (employee_id, employee_name, leave_type, start_date, end_date, days_requested, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [employee_id, employee_name, leave_type, start_date, end_date, days_requested, reason || null]
  );
  const [newLeave] = await pool.execute('SELECT * FROM leave_requests WHERE id = ?', [result.insertId]);
  res.json(newLeave[0]);
});
// 取得所有使用者
app.get('/api/users', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM users');
  res.json(rows);
});
// 新增使用者
app.post('/api/users', async (req, res) => {
  const { username, email, password_hash, role, employee_id, active } = req.body;
  if (!username || !email || !password_hash) {
    return res.status(400).json({ error: '所有必填欄位皆需填寫' });
  }
  const [result] = await pool.execute(
    'INSERT INTO users (username, email, password_hash, role, employee_id, active) VALUES (?, ?, ?, ?, ?, ?)',
    [username, email, password_hash, role || 'employee', employee_id || null, active !== undefined ? active : true]
  );
  const [newUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
  res.json(newUser[0]);
});
// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
}); 