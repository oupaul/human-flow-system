-- 既有部署（資料庫已存在資料）套用此檔以支援「特休週年結算」與薪資折現功能。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   mysql -u root -p hrms_database < server/migrations/001_leave_periods.sql
--
-- 套用結構變更後，還需要執行 `npm run migrate:leave-periods` 幫既有在職員工
-- 補建目前這期的特休週年紀錄（會沿用 leave_balances 裡現有的已用天數當起點）。

ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthlySalary DECIMAL(10,0) NULL;

CREATE TABLE IF NOT EXISTS leave_periods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  periodStart DATE NOT NULL,
  periodEnd DATE NOT NULL,
  grantedDays DECIMAL(4,1) NOT NULL DEFAULT 0,
  carriedInDays DECIMAL(4,1) NOT NULL DEFAULT 0,
  usedDays DECIMAL(4,1) NOT NULL DEFAULT 0,
  settledAt TIMESTAMP NULL,
  carriedOutDays DECIMAL(4,1) NULL,
  cashOutDays DECIMAL(4,1) NULL,
  cashOutAmount DECIMAL(10,0) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);
