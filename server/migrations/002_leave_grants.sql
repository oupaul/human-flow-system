-- 既有部署（資料庫已存在資料）套用此檔以支援「假別核給」（喪假/婚假等同一
-- 事由分次請假的天數上限追蹤）功能。全新安裝直接用 server/schema.sql 建置
-- 即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/002_leave_grants.sql

CREATE TABLE IF NOT EXISTS leave_grants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  leaveTypeId INT NOT NULL,
  totalDays DECIMAL(4,1) NOT NULL,
  usedDays DECIMAL(4,1) NOT NULL DEFAULT 0,
  deadline DATE NULL,
  note VARCHAR(255) NULL,
  createdBy VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId),
  FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id)
);

ALTER TABLE leave_applications ADD COLUMN IF NOT EXISTS grantId INT NULL;
ALTER TABLE leave_applications ADD CONSTRAINT IF NOT EXISTS fk_leave_applications_grant
  FOREIGN KEY (grantId) REFERENCES leave_grants(id) ON DELETE SET NULL;
