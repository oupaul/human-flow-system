-- 既有部署（資料庫已存在資料）套用此檔以支援「自建打卡」（階段 A）：
--   打卡事件（只新增、不可改，更正以作廢＋補登留下稽核軌跡）、員工打卡裝置綁定、打卡設定（IP 限制、裝置綁定模式）、
--   員工出勤來源（外部匯入／系統打卡）、首次登入強制改密碼。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/019_punch.sql
--
-- 注意：既有的「員工」角色帳號會被標記為「下次登入必須改密碼」（預設密碼是員工編號，打卡要避免被冒用）。
-- admin／hr／manager 不受影響。

-- 先以 DEFAULT TRUE 新增欄位讓既有帳號都被標記，再把預設值改回 FALSE（重複執行不會再次強制）
ALTER TABLE users ADD COLUMN IF NOT EXISTS mustChangePassword BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN mustChangePassword SET DEFAULT FALSE;
UPDATE users SET mustChangePassword = FALSE WHERE role <> 'employee';

-- attendanceSource：import＝考勤由外部系統匯入（原本行為）；system＝使用系統打卡，匯入時會略過這些員工
-- punchIpExempt：外勤等不受「打卡 IP 限制」的員工
ALTER TABLE employees ADD COLUMN IF NOT EXISTS attendanceSource ENUM('import', 'system') NOT NULL DEFAULT 'import';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS punchIpExempt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source ENUM('import', 'system') NOT NULL DEFAULT 'import';

-- 打卡設定（單一列 id=1）
--   ipAllowlist：允許打卡的 IPv4 位址或網段（CIDR），一行一個；空白表示不限制
--   deviceBinding：off 不檢查；flag 只標記異常；enforce 未核准的裝置不能打卡
CREATE TABLE IF NOT EXISTS attendance_settings (
  id INT PRIMARY KEY DEFAULT 1,
  defaultShiftStart TIME NOT NULL DEFAULT '09:00:00',
  defaultShiftEnd TIME NOT NULL DEFAULT '18:00:00',
  ipAllowlist TEXT NULL,
  deviceBinding ENUM('off', 'flag', 'enforce') NOT NULL DEFAULT 'enforce',
  maxDevicesPerEmployee INT NOT NULL DEFAULT 2,
  autoApproveFirstDevice BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO attendance_settings (id) VALUES (1);

-- 打卡裝置：每個瀏覽器產生一組隨機識別碼（只存雜湊），登記在某位員工名下；一個識別碼只能屬於一位員工。
-- 這是瀏覽器層級的綁定（網頁拿不到硬體 MAC 位址），用來防止替別人打卡
CREATE TABLE IF NOT EXISTS punch_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  tokenHash CHAR(64) NOT NULL UNIQUE,
  label VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'revoked') NOT NULL DEFAULT 'pending',
  firstSeenAt DATETIME NOT NULL,
  lastSeenAt DATETIME NOT NULL,
  lastIp VARCHAR(45) NULL,
  approvedBy VARCHAR(100) NULL,
  approvedAt DATETIME NULL,
  INDEX idx_device_employee (employeeId)
);

-- 打卡事件：時間一律取伺服器時間（台北時間），不信任用戶端。只新增不修改內容；
-- 更正時把原事件標記為作廢（保留原始紀錄與作廢原因），再視需要補登一筆 source='correction' 的事件。
-- 不設外鍵：員工日後離職或刪除，出勤紀錄依法仍須保存
CREATE TABLE IF NOT EXISTS punch_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  punchAt DATETIME NOT NULL,
  workDate DATE NOT NULL,
  type ENUM('in', 'out') NOT NULL,
  source ENUM('web', 'correction') NOT NULL DEFAULT 'web',
  ip VARCHAR(45) NULL,
  userAgent VARCHAR(255) NULL,
  deviceId INT NULL,
  flags VARCHAR(255) NULL,
  note VARCHAR(255) NULL,
  createdBy VARCHAR(100) NULL,
  status ENUM('valid', 'voided') NOT NULL DEFAULT 'valid',
  voidedBy VARCHAR(100) NULL,
  voidedAt DATETIME NULL,
  voidReason VARCHAR(255) NULL,
  INDEX idx_punch_employee_date (employeeId, workDate),
  INDEX idx_punch_at (punchAt)
);
