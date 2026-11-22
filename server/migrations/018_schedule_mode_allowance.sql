-- 既有部署（資料庫已存在資料）套用此檔以支援「排班制」：
--   員工的出勤制度（固定制／排班制）、排班制假日津貼規則，以及薪資試算中的津貼欄位。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/018_schedule_mode_allowance.sql

-- 固定制：休息日、例假日固定在週六日，加班日別依申請單勾選與行事曆判斷。
-- 排班制：休息日、例假日、國定假日都只是平移到別天，日別完全依個人排班（考勤匯入的排定班別與休息日標記）判斷——
--   排定上班的日子（即使是週六日或國定假日）就是一般上班日，排定休息的日子上班才算休息日／例假日／國定假日出勤。
-- employees.scheduleMode 為 NULL 表示使用公司預設
ALTER TABLE employees ADD COLUMN IF NOT EXISTS scheduleMode ENUM('fixed', 'rotating') NULL;
ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS defaultScheduleMode ENUM('fixed', 'rotating') NOT NULL DEFAULT 'fixed';

-- 排班制假日津貼：排定在指定日別上班就額外給固定金額（公司福利，不能抵扣法定加班費）
CREATE TABLE IF NOT EXISTS shift_allowance_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  weekdays VARCHAR(20) NOT NULL DEFAULT '',          -- 適用的星期（ISO：1=週一…7=週日，逗號分隔，例如 6,7）
  includeNationalHolidays BOOLEAN NOT NULL DEFAULT FALSE,  -- 行事曆上有節日名稱的日子也適用
  amount DECIMAL(10,0) NOT NULL,                     -- 每天金額
  requireAttendance BOOLEAN NOT NULL DEFAULT TRUE,   -- TRUE：必須實際有打卡出勤才給（請假、缺卡不給）
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE payroll_snapshot_items ADD COLUMN IF NOT EXISTS allowanceDays INT NULL;
ALTER TABLE payroll_snapshot_items ADD COLUMN IF NOT EXISTS allowancePay DECIMAL(10,0) NULL;
