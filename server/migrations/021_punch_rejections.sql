-- 既有部署（資料庫已存在資料）套用此檔以記錄「被擋下的打卡嘗試」（IP 不符、裝置未核准／他人裝置等），
-- 供「打卡異常統計」評估是否需要 QR 碼或定位等更強的防護。全新安裝直接用 server/schema.sql 即可。
-- 只會從套用後開始記錄，之前被擋下的嘗試沒有留下紀錄，統計頁會標示記錄起點。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/021_punch_rejections.sql

CREATE TABLE IF NOT EXISTS punch_rejections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NULL,
  attemptedAt DATETIME NOT NULL,
  type VARCHAR(10) NULL,                  -- 嘗試的是上班（in）還是下班（out）
  code VARCHAR(30) NOT NULL,              -- IP_BLOCKED、DEVICE_OTHER、DEVICE_PENDING、DEVICE_REVOKED、DEVICE_LIMIT、DEVICE_MISSING、ALREADY_IN、NOT_IN、TOO_FAST…
  ip VARCHAR(45) NULL,
  deviceLabel VARCHAR(255) NULL,
  INDEX idx_rej_at (attemptedAt),
  INDEX idx_rej_employee (employeeId)
);
