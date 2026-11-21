-- 既有部署（資料庫已存在資料）套用此檔以支援「年資福利提醒」（旅遊補助、留任獎金）。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/011_seniority_benefits.sql

-- 年資福利規則：由 HR 設定，例如「留任獎金：滿 3 年」「旅遊補助：滿 1 年起每年一次」
CREATE TABLE IF NOT EXISTS seniority_benefit_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('travel_subsidy', 'retention_bonus', 'other') NOT NULL DEFAULT 'other',
  startYears INT NOT NULL,                   -- 第一次符合資格的年資（滿幾年）
  repeatEveryYears INT NULL,                 -- 之後每隔幾年再符合一次；NULL 表示僅一次
  amount DECIMAL(10,0) NULL,                 -- 參考金額，可留空
  remindDaysBefore INT NOT NULL DEFAULT 30,  -- 資格日前幾天開始提醒
  notifyHr BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 年資福利紀錄：排程每找到一筆「員工 × 規則 × 資格日」就建立一筆，同時用來防止重複提醒，
-- 也是日後 HR 標記「已核發／略過」的待辦清單
CREATE TABLE IF NOT EXISTS seniority_benefit_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ruleId INT NOT NULL,
  employeeId VARCHAR(50) NOT NULL,
  eligibleDate DATE NOT NULL,
  status ENUM('pending', 'notified', 'paid', 'skipped') NOT NULL DEFAULT 'pending',
  notifiedAt DATETIME NULL,
  paidAt DATE NULL,
  paidAmount DECIMAL(10,0) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rule_employee_date (ruleId, employeeId, eligibleDate),
  FOREIGN KEY (ruleId) REFERENCES seniority_benefit_rules(id),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId) ON DELETE CASCADE
);
