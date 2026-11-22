-- 既有部署（資料庫已存在資料）套用此檔以支援「薪資異動歷史」與勞保／健保／勞退投保薪資。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/014_employee_compensation.sql
--
-- employees.monthlySalary 仍保留，作為「目前生效月薪」的快取（特休／補休折現等功能直接讀它），
-- 由本表最新一筆「生效日 <= 今天」的紀錄同步而來；請透過薪資異動紀錄修改，不要只改快取。

CREATE TABLE IF NOT EXISTS employee_compensation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  effectiveDate DATE NOT NULL,                  -- 生效日；同一員工同一天只能有一筆
  monthlySalary DECIMAL(10,0) NOT NULL,         -- 月薪
  laborInsuredSalary DECIMAL(10,0) NULL,        -- 勞保投保薪資
  healthInsuredSalary DECIMAL(10,0) NULL,       -- 健保投保薪資
  pensionWage DECIMAL(10,0) NULL,               -- 勞退月提繳工資
  voluntaryPensionRate DECIMAL(3,1) NULL,       -- 員工自願提繳率（%，0～6）
  healthDependents INT NULL,                    -- 健保眷屬人數
  notes TEXT NULL,
  changedBy VARCHAR(100) NULL,                  -- 最後異動者（登入帳號）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_employee_effective (employeeId, effectiveDate),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId) ON DELETE CASCADE
);

-- 把既有員工的月薪轉成第一筆異動紀錄（生效日取到職日），可重複執行
INSERT IGNORE INTO employee_compensation (employeeId, effectiveDate, monthlySalary, notes, changedBy)
SELECT employeeId, joinDate, monthlySalary, '由既有月薪欄位轉入', 'migration-014'
FROM employees WHERE monthlySalary IS NOT NULL AND monthlySalary > 0;
