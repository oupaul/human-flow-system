
# MariaDB API 設置說明

## 前置需求

1. 安裝 Node.js (建議版本 16 或以上)
2. 安裝 MariaDB 並確保其正在運行
3. 創建一個資料庫和部門資料表

## 步驟 1: 在 MariaDB 中創建資料表

```sql
CREATE DATABASE IF NOT EXISTS your_database;
USE your_database;

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

- `GET /api/departments` - 獲取所有部門
- `POST /api/departments` - 新增部門
- `PUT /api/departments/:id` - 更新部門
- `DELETE /api/departments/:id` - 刪除部門

## 測試 API

您可以使用 curl 或 Postman 來測試 API：

```bash
# 獲取所有部門
curl http://localhost:3001/api/departments

# 新增部門
curl -X POST http://localhost:3001/api/departments \
  -H "Content-Type: application/json" \
  -d '{"name":"IT部門","leadName":"張三","description":"負責IT相關工作"}'
```

## 前端連接

前端應用程式已經配置為連接到 `http://localhost:3001/api`。
確保 API 伺服器正在運行，前端就能自動連接並顯示資料庫中的部門資料。

## 疑難排解

1. **連接錯誤**: 確保 MariaDB 正在運行且連接配置正確
2. **CORS 錯誤**: 已經配置了 CORS，應該不會有跨域問題
3. **端口衝突**: 如果 3001 端口被佔用，請更改端口並更新前端的 API_BASE_URL
