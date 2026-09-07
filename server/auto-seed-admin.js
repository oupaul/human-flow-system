// 自動建立初始管理員帳號：僅在資料庫裡完全沒有任何 admin 角色帳號時才會
// 建立，絕不會覆蓋既有帳號的密碼（跟 seed-admin.js 不同，seed-admin.js
// 是給要手動重設密碼/自訂帳號名稱用的，這支是給全新部署第一次啟動用的）。
// 由 Dockerfile 在容器啟動時自動呼叫，一般不需要手動執行。
// 任何失敗都只記錄一行 log，絕不能讓這個便利功能擋住主服務啟動
import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'hrms_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hrms_database',
    port: Number(process.env.DB_PORT) || 3306,
  });

  const [rows] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  if (rows[0].count > 0) {
    console.log('[auto-seed-admin] 已存在管理員帳號，略過自動建立');
    await pool.end();
    return;
  }

  const username = 'admin';
  const password = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.execute(
    `INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, 'admin', TRUE)`,
    [username, passwordHash]
  );

  console.log('============================================================');
  console.log('✅ 已自動建立初始管理員帳號，請盡快登入後至「個人設定」修改密碼');
  console.log(`   帳號：${username}`);
  console.log(`   密碼：${password}`);
  console.log('   （這組密碼只會在這裡顯示一次，之後只能用 seed-admin.js 重設）');
  console.log('============================================================');
  await pool.end();
}

try {
  await main();
} catch (error) {
  console.error('[auto-seed-admin] 自動建立管理員帳號失敗（不影響主服務啟動）：', error.message);
}
