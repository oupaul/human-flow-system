-- 既有部署（資料庫已存在資料）套用此檔以支援請假紀錄匯入與報表。全新安裝直接用
-- server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/009_leave_import.sql

CREATE TABLE IF NOT EXISTS imported_leave_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  leaveType VARCHAR(50) NOT NULL,
  startDateTime DATETIME NOT NULL,
  endDateTime DATETIME NOT NULL,
  days DECIMAL(4,1) NULL,
  hours DECIMAL(5,1) NULL,
  minutes DECIMAL(6,1) NULL,
  status VARCHAR(20) NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY employee_leave_period (employeeId, leaveType, startDateTime, endDateTime),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);
