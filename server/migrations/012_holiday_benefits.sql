-- 既有部署（資料庫已存在資料）套用此檔以支援「節日福利提醒」（開工紅包、端午禮金、中秋禮金等
-- 日期每年不固定的全公司福利）。全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/012_holiday_benefits.sql

-- 節日福利規則：全公司同一天、全員同額。日期來源有兩種：
--   holiday_name：比對「假日行事曆（holidays）」的節日名稱關鍵字（如「端午」「中秋」），自動抓當年日期
--   manual：由 HR 每年手動填日期（如公司公告的開工日）
CREATE TABLE IF NOT EXISTS holiday_benefit_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  dateSource ENUM('holiday_name', 'manual') NOT NULL DEFAULT 'holiday_name',
  holidayKeyword VARCHAR(100) NULL,          -- dateSource=holiday_name 時必填
  amount DECIMAL(10,0) NULL,                 -- 每人金額（全員同額）
  remindDaysBefore INT NOT NULL DEFAULT 14,  -- 節日／發放日前幾天提醒
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 節日福利年度紀錄：每條規則每年一筆（全公司批次，不是逐人），同時用來防止重複提醒
CREATE TABLE IF NOT EXISTS holiday_benefit_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ruleId INT NOT NULL,
  year INT NOT NULL,
  eventDate DATE NOT NULL,                   -- 節日或發放日
  status ENUM('pending', 'notified', 'paid', 'skipped') NOT NULL DEFAULT 'pending',
  headcount INT NULL,                        -- 提醒當下的在職人數
  estimatedTotal DECIMAL(12,0) NULL,         -- 預估總額 = 每人金額 × 在職人數
  notifiedAt DATETIME NULL,
  paidAt DATE NULL,
  paidAmount DECIMAL(12,0) NULL,             -- 實際核發總額
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rule_year (ruleId, year),
  FOREIGN KEY (ruleId) REFERENCES holiday_benefit_rules(id)
);
