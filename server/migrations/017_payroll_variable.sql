-- 既有部署（資料庫已存在資料）套用此檔以支援「薪資計算」：計薪區間（例如上月 26 日～本月 25 日）內
-- 已核准的加班費與請假扣薪，併入每月試算快照。全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/017_payroll_variable.sql

-- 計薪設定（單一列 id=1）：底薪與勞健退按完整日曆月；只有請假、加班取「上月 (cutoffDay+1) 日 ~ 本月 cutoffDay 日」
-- 例如 cutoffDay=25，計算 10 月薪資時，請假、加班取 9/26 ~ 10/25。日薪＝月薪÷daysPerMonth，時薪＝日薪÷hoursPerDay
CREATE TABLE IF NOT EXISTS payroll_settings (
  id INT PRIMARY KEY DEFAULT 1,
  cutoffDay INT NOT NULL DEFAULT 25,
  daysPerMonth INT NOT NULL DEFAULT 30,
  hoursPerDay INT NOT NULL DEFAULT 8,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO payroll_settings (id, cutoffDay, daysPerMonth, hoursPerDay) VALUES (1, 25, 30, 8);

-- 加班費倍率（依日別與累計加班時數分段，同一天的加班時數合併累計）。系統不內建倍率，
-- 由 HR 匯入 CSV 或載入「勞基法範本」後依公司規定修改
--   weekday：平日　rest_day：休息日（假日出勤且行事曆上沒有節日名稱）　holiday：國定假日（行事曆上有節日名稱）
CREATE TABLE IF NOT EXISTS overtime_pay_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dayType ENUM('weekday', 'rest_day', 'holiday') NOT NULL,
  fromHours DECIMAL(4,1) NOT NULL,
  toHours DECIMAL(4,1) NULL,                 -- NULL 表示沒有上限
  multiplier DECIMAL(5,3) NOT NULL
);

-- 各假別的請假扣薪比例：0＝不扣、0.5＝扣半薪、1＝全扣。未設定的假別在產生薪資時會報錯
CREATE TABLE IF NOT EXISTS leave_type_deductions (
  leaveTypeId INT PRIMARY KEY,
  deductRatio DECIMAL(4,2) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id) ON DELETE CASCADE
);

ALTER TABLE payroll_snapshots ADD COLUMN IF NOT EXISTS periodStart DATE NULL;
ALTER TABLE payroll_snapshots ADD COLUMN IF NOT EXISTS periodEnd DATE NULL;
ALTER TABLE payroll_snapshot_items ADD COLUMN IF NOT EXISTS overtimeHours DECIMAL(5,1) NULL;
ALTER TABLE payroll_snapshot_items ADD COLUMN IF NOT EXISTS overtimePay DECIMAL(10,0) NULL;
ALTER TABLE payroll_snapshot_items ADD COLUMN IF NOT EXISTS leaveDays DECIMAL(5,1) NULL;
ALTER TABLE payroll_snapshot_items ADD COLUMN IF NOT EXISTS leaveDeduction DECIMAL(10,0) NULL;
ALTER TABLE payroll_snapshot_items ADD COLUMN IF NOT EXISTS variableDetail TEXT NULL;  -- 納入的加班／請假明細（JSON），供核對與稽核
