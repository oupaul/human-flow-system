
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

// API 路由

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

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  console.log('請確保 MariaDB 資料庫已運行並且連接配置正確');
});

// 建立部門資料表的 SQL（如果需要的話）
/*
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
