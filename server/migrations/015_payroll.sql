-- 既有部署（資料庫已存在資料）套用此檔以支援「人事成本」：保險費率與級距表（HR 貼 CSV 維護）、
-- 每月勞健退試算快照。全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/015_payroll.sql

-- 保險費率與負擔比例，每個項目依生效日保留歷史；系統不內建任何數字，全部由 HR 匯入
CREATE TABLE IF NOT EXISTS insurance_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  effectiveDate DATE NOT NULL,
  rateKey VARCHAR(50) NOT NULL,
  value DECIMAL(10,4) NOT NULL,
  note VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rate (effectiveDate, rateKey)
);

-- 投保薪資／提繳工資分級表：用來核對員工的投保薪資是否落在級距、有沒有低於月薪對應的級距
CREATE TABLE IF NOT EXISTS insurance_brackets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  effectiveDate DATE NOT NULL,
  bracketType ENUM('labor', 'health', 'pension') NOT NULL,
  amount DECIMAL(10,0) NOT NULL,
  UNIQUE KEY uniq_bracket (effectiveDate, bracketType, amount)
);

-- 每月試算快照：草稿可重新產生，鎖定後凍結（之後調整費率或薪資都不會改動已鎖定的數字）
CREATE TABLE IF NOT EXISTS payroll_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month CHAR(7) NOT NULL UNIQUE,             -- YYYY-MM
  status ENUM('draft', 'locked') NOT NULL DEFAULT 'draft',
  ratesUsed TEXT NULL,                       -- 產生當下使用的費率（JSON），供日後稽核
  headcount INT NOT NULL DEFAULT 0,
  generatedAt DATETIME NULL,
  generatedBy VARCHAR(100) NULL,
  lockedAt DATETIME NULL,
  lockedBy VARCHAR(100) NULL
);

CREATE TABLE IF NOT EXISTS payroll_snapshot_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snapshotId INT NOT NULL,
  employeeId VARCHAR(50) NOT NULL,           -- 不設外鍵：員工日後離職或刪除，歷史快照仍要保留
  employeeName VARCHAR(255) NOT NULL,
  department VARCHAR(255) NULL,
  monthlySalary DECIMAL(10,0) NULL,
  laborInsured DECIMAL(10,0) NULL,
  healthInsured DECIMAL(10,0) NULL,
  pensionWage DECIMAL(10,0) NULL,
  voluntaryPensionRate DECIMAL(3,1) NULL,
  healthDependents INT NULL,
  laborEmployee DECIMAL(10,0) NULL,
  laborEmployer DECIMAL(10,0) NULL,
  healthEmployee DECIMAL(10,0) NULL,
  healthEmployer DECIMAL(10,0) NULL,
  pensionEmployer DECIMAL(10,0) NULL,
  pensionEmployee DECIMAL(10,0) NULL,
  warnings TEXT NULL,
  INDEX idx_snapshot (snapshotId),
  FOREIGN KEY (snapshotId) REFERENCES payroll_snapshots(id) ON DELETE CASCADE
);
