
# MariaDB API 設置說明

## 前置需求

1. 安裝 Node.js (建議版本 16 或以上)
2. 安裝 MariaDB 並確保其正在運行
3. 創建一個資料庫和所需的資料表

## 步驟 1: 在 MariaDB 中創建資料表

```sql
CREATE DATABASE IF NOT EXISTS your_database;
USE your_database;

-- 部門資料表
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

-- 員工資料表
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

-- 插入範例資料
INSERT INTO departments (name, leadName, description) VALUES
('IT部門', '張三', '負責IT相關工作'),
('人資部門', '李四', '負責人力資源管理'),
('財務部門', '王五', '負責財務管理'),
('行銷部門', '陳六', '負責行銷推廣'),
('業務部門', '林七', '負責業務開發');

INSERT INTO employees (name, employeeId, department, position, email, phone, joinDate, active, address, notes) VALUES
('張小明', 'EMP001', 'IT部門', '軟體工程師', 'ming@example.com', '0912-345-678', '2020-01-15', TRUE, '', ''),
('李小華', 'EMP002', '人資部門', '人資專員', 'hua@example.com', '0923-456-789', '2019-05-20', TRUE, '', ''),
('王大明', 'EMP003', '財務部門', '會計師', 'daming@example.com', '0934-567-890', '2021-03-10', TRUE, '', ''),
('陳小玲', 'EMP004', '行銷部門', '行銷經理', 'ling@example.com', '0945-678-901', '2018-11-05', FALSE, '', ''),
('林小美', 'EMP005', '業務部門', '業務代表', 'mei@example.com', '0956-789-012', '2022-02-15', TRUE, '', '');
```

## 步驟 2: 安裝 Node.js 依賴

```bash
npm init -y
npm install express mysql2 cors
```

## 步驟 3: 配置資料庫連接

編輯 `mariadb-api-server.js` 文件中的資料庫配置：

```javascript
const dbConfig = {
  host: 'localhost',
  user: 'your_username',        // 替換為您的 MariaDB 使用者名稱
  password: 'your_password',    // 替換為您的 MariaDB 密碼
  database: 'your_database',    // 替換為您的資料庫名稱
  port: 3306
};
```

## 步驟 4: 啟動 API 伺服器

```bash
node mariadb-api-server.js
```

伺服器將在 `http://localhost:3001` 運行

## API 端點

### 部門管理
- `GET /api/departments` - 獲取所有部門
- `POST /api/departments` - 新增部門
- `PUT /api/departments/:id` - 更新部門
- `DELETE /api/departments/:id` - 刪除部門

### 員工管理
- `GET /api/employees` - 獲取所有員工
- `POST /api/employees` - 新增員工
- `PUT /api/employees/:id` - 更新員工
- `DELETE /api/employees/:id` - 刪除員工
- `PUT /api/employees/:id/terminate` - 員工離職

### Dashboard
- `GET /api/dashboard/stats` - 獲取統計資料
- `GET /api/dashboard/attendance` - 獲取部門出勤率
- `GET /api/dashboard/leaves` - 獲取請假分布

## 測試 API

您可以使用 curl 或 Postman 來測試 API：

```bash
# 獲取所有部門
curl http://localhost:3001/api/departments

# 獲取所有員工
curl http://localhost:3001/api/employees

# 獲取 Dashboard 統計
curl http://localhost:3001/api/dashboard/stats

# 新增員工
curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"測試員工","employeeId":"EMP999","department":"IT部門","position":"工程師","email":"test@example.com","phone":"0912-345-678","joinDate":"2024-01-01","active":true}'
```

## 前端連接

前端應用程式已經配置為連接到 `http://localhost:3001/api`。
確保 API 伺服器正在運行，前端就能自動連接並顯示資料庫中的資料。

## 疑難排解

1. **連接錯誤**: 確保 MariaDB 正在運行且連接配置正確
2. **CORS 錯誤**: 已經配置了 CORS，應該不會有跨域問題
3. **端口衝突**: 如果 3001 端口被佔用，請更改端口並更新前端的 API_BASE_URL
4. **資料表不存在**: 請確保已經執行了上述的 SQL 建表語句

## 注意事項

- Dashboard 的部分統計資料目前使用模擬資料，您需要根據實際需求建立對應的資料表（如請假表、出勤表等）
- 請定期備份資料庫
- 在生產環境中，請使用適當的身份驗證和授權機制
