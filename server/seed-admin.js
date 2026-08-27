// 建立或更新一個管理員帳號，方便第一次部署後登入
// 用法：ADMIN_PASSWORD=你的密碼 npm run seed:admin
// 可選：ADMIN_USERNAME=自訂帳號（預設 admin）

import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.error('請設定 ADMIN_PASSWORD 環境變數後再執行，例如：\n  ADMIN_PASSWORD=你的密碼 npm run seed:admin');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'hrms_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hrms_database',
  port: Number(process.env.DB_PORT) || 3306,
});

const passwordHash = await bcrypt.hash(password, 10);

await pool.execute(
  `INSERT INTO users (username, password_hash, role, active)
   VALUES (?, ?, 'admin', TRUE)
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin', active = TRUE`,
  [username, passwordHash]
);

console.log(`✅ 已建立/更新管理員帳號：${username}`);
await pool.end();
