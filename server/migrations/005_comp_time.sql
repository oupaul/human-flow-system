-- 既有部署（資料庫已存在資料）套用此檔以支援「補休」功能：加班申請可選擇領加班費
-- 或換補休，核准後依勞基法第 32-1 條以工作時數 1:1 換算成補休時數，補休可透過請假申請（假別選補休）
-- 使用，到期未休完的部分由 HR 結算折算加班費。全新安裝直接用 server/schema.sql
-- 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/005_comp_time.sql

ALTER TABLE overtime_applications ADD COLUMN IF NOT EXISTS compensationType ENUM('pay', 'comp') NOT NULL DEFAULT 'pay';
ALTER TABLE overtime_applications ADD COLUMN IF NOT EXISTS compHours DECIMAL(4,1) NULL;

CREATE TABLE IF NOT EXISTS comp_time_grants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  overtimeApplicationId INT NOT NULL UNIQUE,
  hours DECIMAL(4,1) NOT NULL,
  usedHours DECIMAL(4,1) NOT NULL DEFAULT 0,
  deadline DATE NOT NULL,
  settledAt TIMESTAMP NULL,
  cashOutHours DECIMAL(4,1) NULL,
  cashOutAmount DECIMAL(10,0) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId),
  FOREIGN KEY (overtimeApplicationId) REFERENCES overtime_applications(id)
);

CREATE TABLE IF NOT EXISTS comp_time_usages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grantId INT NOT NULL,
  leaveApplicationId INT NOT NULL,
  hours DECIMAL(4,1) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grantId) REFERENCES comp_time_grants(id),
  FOREIGN KEY (leaveApplicationId) REFERENCES leave_applications(id)
);

INSERT IGNORE INTO leave_types (name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit)
VALUES ('補休', 'COMP', '小時', FALSE, FALSE, TRUE, '依補休餘額', '當天', TRUE);
