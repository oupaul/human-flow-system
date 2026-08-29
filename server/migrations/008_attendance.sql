-- 既有部署（資料庫已存在資料）套用此檔以支援考勤紀錄匯入與報表。全新安裝直接用
-- server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/008_attendance.sql

ALTER TABLE employees ADD COLUMN IF NOT EXISTS attendanceAccount VARCHAR(100) NULL UNIQUE;

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  shiftStart TIME NULL,
  shiftEnd TIME NULL,
  clockIn TIME NULL,
  clockOut TIME NULL,
  status ENUM('normal', 'missing', 'day_off', 'leave') NOT NULL,
  note VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY employee_date (employeeId, date),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);
