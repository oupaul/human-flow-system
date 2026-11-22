-- 既有部署（資料庫已存在資料）套用此檔以支援自建打卡階段 B：
--   班別與月份班表、補卡申請、公出申請、缺卡異常記錄。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/020_schedule_requests.sql

ALTER TABLE attendance_settings ADD COLUMN IF NOT EXISTS defaultBreakMinutes INT NOT NULL DEFAULT 60;

-- 班別（例如早班 08:00-17:00、晚班 14:00-23:00）；下班時間早於上班時間表示跨夜班
CREATE TABLE IF NOT EXISTS shift_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  startTime TIME NOT NULL,
  endTime TIME NOT NULL,
  breakMinutes INT NOT NULL DEFAULT 60,       -- 休息時間（分鐘），不計入工時
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 月份班表：每人每天一列，上班（指派班別）或排休。
--   off 的 offType：rest_day 休息日、regular_off 例假日、national_holiday 平移後的國定假日
--   published：是否已發布給員工看（草稿也會被打卡與薪資計算使用，發布只影響員工能不能看到）
-- 沒有班表的員工與日期，固定制依預設班別與行事曆判斷
CREATE TABLE IF NOT EXISTS work_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  kind ENUM('shift', 'off') NOT NULL,
  shiftTypeId INT NULL,
  offType ENUM('rest_day', 'regular_off', 'national_holiday') NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  updatedBy VARCHAR(100) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_schedule (employeeId, date),
  INDEX idx_schedule_date (date),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId) ON DELETE CASCADE,
  FOREIGN KEY (shiftTypeId) REFERENCES shift_types(id)
);

-- 補卡申請：員工提出、主管或 HR 核准後自動補登一筆打卡
CREATE TABLE IF NOT EXISTS punch_correction_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  workDate DATE NOT NULL,
  type ENUM('in', 'out') NOT NULL,
  requestedTime TIME NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewer VARCHAR(100) NULL,
  reviewNote VARCHAR(255) NULL,
  reviewedAt DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pcr_employee (employeeId),
  INDEX idx_pcr_status (status)
);

-- 公出（外出洽公、出差）：核准期間不算缺卡，且當天可在允許網路以外打卡
CREATE TABLE IF NOT EXISTS outing_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  destination VARCHAR(255) NOT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewer VARCHAR(100) NULL,
  reviewNote VARCHAR(255) NULL,
  reviewedAt DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_outing_employee (employeeId),
  INDEX idx_outing_status (status)
);

-- 缺卡異常：每天排程找出「該上班卻沒有完整打卡」的員工，記錄並通知 HR（同一天同一種異常只通知一次）
--   no_punch 完全沒打卡；missing_in 缺上班；missing_out 缺下班
CREATE TABLE IF NOT EXISTS punch_exceptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  workDate DATE NOT NULL,
  kind ENUM('no_punch', 'missing_in', 'missing_out') NOT NULL,
  detectedAt DATETIME NOT NULL,
  UNIQUE KEY uniq_exception (employeeId, workDate, kind),
  INDEX idx_exception_date (workDate)
);
