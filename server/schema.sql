-- HRMS 資料庫結構
-- 手動建置：先建立好資料庫並選取後執行，例如：
--   mysql -u root -p hrms_database < server/schema.sql
-- Docker：透過 docker-entrypoint-initdb.d 自動於容器初次啟動時執行

-- 部門表
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  leadName VARCHAR(255) NOT NULL,
  parentId INT DEFAULT NULL,
  employeeCount INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parentId) REFERENCES departments(id) ON DELETE SET NULL
);

-- 員工表
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  employeeId VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  joinDate DATE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  terminationDate DATE NULL,
  terminationReason TEXT NULL,
  address TEXT,
  notes TEXT,
  monthlySalary DECIMAL(10,0) NULL,
  gender ENUM('male', 'female') NULL,
  attendanceAccount VARCHAR(100) NULL UNIQUE,
  -- 出勤制度：固定制／排班制（排班制的休息日、例假日、國定假日都平移，日別依個人排班判斷）；NULL＝使用公司預設
  scheduleMode ENUM('fixed', 'rotating') NULL,
  -- 出勤來源：import＝考勤由外部系統匯入；system＝使用系統打卡（匯入時略過）；punchIpExempt＝不受打卡 IP 限制（外勤）
  attendanceSource ENUM('import', 'system') NOT NULL DEFAULT 'import',
  punchIpExempt BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 假別類型表
CREATE TABLE IF NOT EXISTS leave_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  unit VARCHAR(50) NOT NULL,
  needProof BOOLEAN DEFAULT FALSE,
  affectAttendance BOOLEAN DEFAULT FALSE,
  isPaid BOOLEAN DEFAULT TRUE,
  maxDays VARCHAR(100),
  advanceApply VARCHAR(100),
  canSplit BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 假別核給表：用於「同一事由分次請假」的假別（如喪假、婚假）。HR 審核過員工
-- 提供的證明文件後，直接核給總天數與應休畢期限；之後同一員工、同一假別的
-- 請假申請會自動從這筆核給扣抵，超過核給剩餘天數時系統會擋下
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

-- 請假申請表
CREATE TABLE IF NOT EXISTS leave_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  leaveTypeId INT NOT NULL,
  grantId INT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  startTime TIME NULL,
  endTime TIME NULL,
  days DECIMAL(3,1) NOT NULL,
  reason TEXT NOT NULL,
  deputy VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approver VARCHAR(255) NULL,
  reviewNote TEXT NULL,
  attachment VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId),
  FOREIGN KEY (grantId) REFERENCES leave_grants(id) ON DELETE SET NULL
);

-- 假別餘額表
CREATE TABLE IF NOT EXISTS leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL UNIQUE,
  annualLeave INT DEFAULT 0,
  annualLeaveUsed INT DEFAULT 0,
  sickLeave INT DEFAULT 30,
  sickLeaveUsed INT DEFAULT 0,
  compensatoryLeave INT DEFAULT 0,
  compensatoryLeaveUsed INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);

-- 特休週年期間表：每位員工每個特休週年都有一筆，記錄該期發放天數、
-- 上期遞延進來的天數、本期已用天數；到期結算後會凍結遞延/折現天數與金額，
-- 並自動開出下一期。特休依勞基法第 38 條僅能遞延一次，故遞延進來的天數
-- 若在本期還是沒休完，結算時必須全數折算工資，不可再遞延
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
  settlementRemindedAt DATETIME NULL,        -- 已通知 HR 週年即將結算的時間，避免重複提醒
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);

-- 國定假日行事曆
CREATE TABLE IF NOT EXISTS holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name VARCHAR(255) NULL,
  isHoliday BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(20) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 考勤紀錄：從外部打卡系統匯出的 .xls 匯入，一天一筆。status 為
-- normal（有正常簽到退）/missing（缺卡）/day_off（休息日或例假日）/leave（請假，
-- note 存原始假別文字僅供參考顯示，不影響本系統自己的請假額度計算）。
-- shiftStart/shiftEnd 來自匯入檔的班別欄位，用於報表計算遲到/早退
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
  source ENUM('import', 'system') NOT NULL DEFAULT 'import',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY employee_date (employeeId, date),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);

-- 匯入的請假紀錄：從外部打卡系統匯出的「請假紀錄」.xls 匯入，用於補齊報表
-- 「請假分析」在正式數位化請假申請功能上線前的歷史資料，純粹供統計使用，
-- 不會寫入 leave_applications，也不影響假別餘額或核准流程。
-- days/hours/minutes 依匯出檔實際填寫的請假單位，可能只有其中之一有值；
-- status 是外部系統的原始狀態文字（如「已生效」），報表只統計已生效的紀錄
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

-- 加班申請表：compensationType 由員工申請時選擇要領加班費還是換補休；
-- compHours 是依勞基法第 32-1 條以工作時數 1:1 換算出的補休時數（僅 compensationType='comp' 時有意義），
-- 核准時才會真的開立補休額度（見 comp_time_grants）
CREATE TABLE IF NOT EXISTS overtime_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  startTime TIME NOT NULL,
  endTime TIME NOT NULL,
  hours DECIMAL(4,1) NOT NULL,
  reason TEXT NOT NULL,
  onHoliday BOOLEAN DEFAULT FALSE,
  compensationType ENUM('pay', 'comp') NOT NULL DEFAULT 'pay',
  compHours DECIMAL(4,1) NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approver VARCHAR(255) NULL,
  reviewNote TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
);

-- 補休額度表：加班申請選擇換補休且核准後，依換算時數開立一筆額度，
-- deadline 為加班日起算 6 個月（比照勞基法函釋常見作法），到期未休完的部分
-- 由 HR 結算（settledAt/cashOutHours/cashOutAmount）折算加班費發放
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

-- 補休使用紀錄：請假申請（假別為補休）核准時，依到期日由近到遠依序扣抵
-- comp_time_grants 額度，記錄扣了哪一筆、扣多少，取消核准時才能正確歸還
CREATE TABLE IF NOT EXISTS comp_time_usages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grantId INT NOT NULL,
  leaveApplicationId INT NOT NULL,
  hours DECIMAL(4,1) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grantId) REFERENCES comp_time_grants(id),
  FOREIGN KEY (leaveApplicationId) REFERENCES leave_applications(id)
);

-- 登入帳號表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'hr', 'manager', 'employee') DEFAULT 'employee',
  employee_id VARCHAR(50) NULL,
  active BOOLEAN DEFAULT TRUE,
  -- 首次登入（或密碼被重設為預設值）後必須先改密碼；員工預設密碼是員工編號，打卡要避免被冒用
  mustChangePassword BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(employeeId)
);

-- 系統通知設定：單一列（id 固定為 1），由「設定」頁面維護，取代舊版純環境變數設定
CREATE TABLE IF NOT EXISTS notification_settings (
  id INT PRIMARY KEY DEFAULT 1,
  channel ENUM('none', 'smtp', 'teams') DEFAULT 'none',
  smtp_host VARCHAR(255) NULL,
  smtp_port INT NULL,
  smtp_secure BOOLEAN DEFAULT FALSE,
  -- 公司自架郵件伺服器常見是自簽憑證或憑證鏈不完整，Node.js 驗證會噴
  -- 「unable to get local issuer certificate」導致寄信失敗；開啟這個選項會
  -- 略過憑證驗證（等同 nodemailer 的 tls.rejectUnauthorized = false）。
  -- 只建議在信任的內部網路環境使用，會降低對 SMTP 連線中間人攻擊的防護
  smtp_allow_self_signed_cert BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_from VARCHAR(255) NULL,
  notification_to_emails VARCHAR(500) NULL,
  smtp_auth_method ENUM('basic', 'oauth2') DEFAULT 'basic',
  smtp_user VARCHAR(255) NULL,
  smtp_password VARCHAR(255) NULL,
  smtp_oauth_user VARCHAR(255) NULL,
  smtp_oauth_client_id VARCHAR(255) NULL,
  smtp_oauth_client_secret VARCHAR(255) NULL,
  smtp_oauth_refresh_token VARCHAR(500) NULL,
  teams_webhook_url VARCHAR(500) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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

-- 薪資異動歷史（僅 admin/hr 可見）：每次調薪或調整投保薪資一筆，employees.monthlySalary 為目前生效月薪的快取
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
  lockedBy VARCHAR(100) NULL,
  periodStart DATE NULL,                     -- 請假、加班的計薪區間
  periodEnd DATE NULL
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
  overtimeHours DECIMAL(5,1) NULL,
  overtimePay DECIMAL(10,0) NULL,
  leaveDays DECIMAL(5,1) NULL,
  leaveDeduction DECIMAL(10,0) NULL,
  allowanceDays INT NULL,
  allowancePay DECIMAL(10,0) NULL,
  variableDetail TEXT NULL,                  -- 納入的加班／請假明細（JSON）
  warnings TEXT NULL,
  INDEX idx_snapshot (snapshotId),
  FOREIGN KEY (snapshotId) REFERENCES payroll_snapshots(id) ON DELETE CASCADE
);

-- 特休／補休調整異動記錄：誰在什麼時候調整了哪位員工的什麼（變更前後），只新增、不修改
CREATE TABLE IF NOT EXISTS leave_adjustment_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  employeeId VARCHAR(50) NOT NULL,           -- 不設外鍵：員工日後離職或刪除，異動記錄仍要保留
  employeeName VARCHAR(255) NULL,            -- 當時的姓名快照
  action VARCHAR(30) NOT NULL,               -- annual_used、annual_carried_in、annual_granted、annual_settle、comp_settle、sick_balance、grant_create、grant_delete
  refId INT NULL,                            -- 對應的特休週年期間／補休額度／核給紀錄 id
  beforeValue VARCHAR(255) NULL,
  afterValue VARCHAR(255) NULL,
  detail VARCHAR(500) NULL,
  actorUsername VARCHAR(100) NULL,
  actorRole VARCHAR(20) NULL,
  INDEX idx_employee (employeeId),
  INDEX idx_created (created_at)
);

-- 計薪設定（單一列 id=1）：底薪與勞健退按完整日曆月；只有請假、加班取「上月 (cutoffDay+1) 日 ~ 本月 cutoffDay 日」
-- 例如 cutoffDay=25，計算 10 月薪資時，請假、加班取 9/26 ~ 10/25。日薪＝月薪÷daysPerMonth，時薪＝日薪÷hoursPerDay
CREATE TABLE IF NOT EXISTS payroll_settings (
  id INT PRIMARY KEY DEFAULT 1,
  cutoffDay INT NOT NULL DEFAULT 25,
  daysPerMonth INT NOT NULL DEFAULT 30,
  hoursPerDay INT NOT NULL DEFAULT 8,
  defaultScheduleMode ENUM('fixed', 'rotating') NOT NULL DEFAULT 'fixed',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO payroll_settings (id, cutoffDay, daysPerMonth, hoursPerDay) VALUES (1, 25, 30, 8);

-- 加班費倍率（依日別與累計加班時數分段，同一天的加班時數合併累計）。系統不內建倍率，
-- 由 HR 匯入 CSV 或載入「勞基法範本」後依公司規定修改
--   weekday：平日　rest_day：休息日（假日出勤且行事曆上沒有節日名稱）　holiday：國定假日（行事曆上有節日名稱）
CREATE TABLE IF NOT EXISTS overtime_pay_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dayType ENUM('weekday', 'rest_day', 'holiday') NOT NULL,
  fromHours DECIMAL(4,1) NOT NULL,
  toHours DECIMAL(4,1) NULL,                 -- NULL 表示沒有上限
  multiplier DECIMAL(5,3) NOT NULL
);

-- 各假別的請假扣薪比例：0＝不扣、0.5＝扣半薪、1＝全扣。未設定的假別在產生薪資時會報錯
CREATE TABLE IF NOT EXISTS leave_type_deductions (
  leaveTypeId INT PRIMARY KEY,
  deductRatio DECIMAL(4,2) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id) ON DELETE CASCADE
);

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

-- 打卡設定（單一列 id=1）
--   ipAllowlist：允許打卡的 IPv4 位址或網段（CIDR），一行一個；空白表示不限制
--   deviceBinding：off 不檢查；flag 只標記異常；enforce 未核准的裝置不能打卡
CREATE TABLE IF NOT EXISTS attendance_settings (
  id INT PRIMARY KEY DEFAULT 1,
  defaultShiftStart TIME NOT NULL DEFAULT '09:00:00',
  defaultShiftEnd TIME NOT NULL DEFAULT '18:00:00',
  ipAllowlist TEXT NULL,
  deviceBinding ENUM('off', 'flag', 'enforce') NOT NULL DEFAULT 'enforce',
  maxDevicesPerEmployee INT NOT NULL DEFAULT 2,
  defaultBreakMinutes INT NOT NULL DEFAULT 60,
  autoApproveFirstDevice BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO attendance_settings (id) VALUES (1);

-- 打卡裝置：每個瀏覽器產生一組隨機識別碼（只存雜湊），登記在某位員工名下；一個識別碼只能屬於一位員工。
-- 這是瀏覽器層級的綁定（網頁拿不到硬體 MAC 位址），用來防止替別人打卡
CREATE TABLE IF NOT EXISTS punch_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  tokenHash CHAR(64) NOT NULL UNIQUE,
  label VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'revoked') NOT NULL DEFAULT 'pending',
  firstSeenAt DATETIME NOT NULL,
  lastSeenAt DATETIME NOT NULL,
  lastIp VARCHAR(45) NULL,
  approvedBy VARCHAR(100) NULL,
  approvedAt DATETIME NULL,
  INDEX idx_device_employee (employeeId)
);

-- 打卡事件：時間一律取伺服器時間（台北時間），不信任用戶端。只新增不修改內容；
-- 更正時把原事件標記為作廢（保留原始紀錄與作廢原因），再視需要補登一筆 source='correction' 的事件。
-- 不設外鍵：員工日後離職或刪除，出勤紀錄依法仍須保存
CREATE TABLE IF NOT EXISTS punch_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  punchAt DATETIME NOT NULL,
  workDate DATE NOT NULL,
  type ENUM('in', 'out') NOT NULL,
  source ENUM('web', 'correction') NOT NULL DEFAULT 'web',
  ip VARCHAR(45) NULL,
  userAgent VARCHAR(255) NULL,
  deviceId INT NULL,
  flags VARCHAR(255) NULL,
  note VARCHAR(255) NULL,
  createdBy VARCHAR(100) NULL,
  status ENUM('valid', 'voided') NOT NULL DEFAULT 'valid',
  voidedBy VARCHAR(100) NULL,
  voidedAt DATETIME NULL,
  voidReason VARCHAR(255) NULL,
  INDEX idx_punch_employee_date (employeeId, workDate),
  INDEX idx_punch_at (punchAt)
);

-- 班別（例如早班 08:00-17:00、晚班 14:00-23:00）；下班時間早於上班時間表示跨夜班
CREATE TABLE IF NOT EXISTS shift_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  startTime TIME NOT NULL,
  endTime TIME NOT NULL,
  breakMinutes INT NOT NULL DEFAULT 60,       -- 休息時間（分鐘），不計入工時
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 月份班表：每人每天一列，上班（指派班別）或排休。
--   off 的 offType：rest_day 休息日、regular_off 例假日、national_holiday 平移後的國定假日
--   published：是否已發布給員工看（草稿也會被打卡與薪資計算使用，發布只影響員工能不能看到）
-- 沒有班表的員工與日期，固定制依預設班別與行事曆判斷
CREATE TABLE IF NOT EXISTS work_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  kind ENUM('shift', 'off') NOT NULL,
  shiftTypeId INT NULL,
  offType ENUM('rest_day', 'regular_off', 'national_holiday') NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  updatedBy VARCHAR(100) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_schedule (employeeId, date),
  INDEX idx_schedule_date (date),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId) ON DELETE CASCADE,
  FOREIGN KEY (shiftTypeId) REFERENCES shift_types(id)
);

-- 補卡申請：員工提出、主管或 HR 核准後自動補登一筆打卡
CREATE TABLE IF NOT EXISTS punch_correction_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  workDate DATE NOT NULL,
  type ENUM('in', 'out') NOT NULL,
  requestedTime TIME NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewer VARCHAR(100) NULL,
  reviewNote VARCHAR(255) NULL,
  reviewedAt DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pcr_employee (employeeId),
  INDEX idx_pcr_status (status)
);

-- 公出（外出洽公、出差）：核准期間不算缺卡，且當天可在允許網路以外打卡
CREATE TABLE IF NOT EXISTS outing_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  destination VARCHAR(255) NOT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewer VARCHAR(100) NULL,
  reviewNote VARCHAR(255) NULL,
  reviewedAt DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_outing_employee (employeeId),
  INDEX idx_outing_status (status)
);

-- 缺卡異常：每天排程找出「該上班卻沒有完整打卡」的員工，記錄並通知 HR（同一天同一種異常只通知一次）
--   no_punch 完全沒打卡；missing_in 缺上班；missing_out 缺下班
CREATE TABLE IF NOT EXISTS punch_exceptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  workDate DATE NOT NULL,
  kind ENUM('no_punch', 'missing_in', 'missing_out') NOT NULL,
  detectedAt DATETIME NOT NULL,
  UNIQUE KEY uniq_exception (employeeId, workDate, kind),
  INDEX idx_exception_date (workDate)
);

-- 範例假別類型（可依需求刪減）
INSERT INTO leave_types (name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit) VALUES
('特休', 'AL', '天', FALSE, FALSE, TRUE, '依年資', '3天', TRUE),
('事假', 'PL', '小時', FALSE, TRUE, FALSE, '14天', '3天', TRUE),
('病假', 'SL', '天', TRUE, FALSE, FALSE, '30天', '當天', TRUE),
('生理假', 'MSL', '天', FALSE, FALSE, FALSE, '每月1日，全年前3日不併入病假計算（依性別工作平等法第14條，皆為半薪）', '當天', TRUE),
('婚假', 'ML', '天', TRUE, FALSE, TRUE, '8天', '7天', FALSE),
('公假', 'OL', '天', TRUE, FALSE, TRUE, '依需求', '3天', TRUE),
('喪假', 'BL', '天', TRUE, FALSE, TRUE, '依親屬關係', '當天', TRUE),
('補休', 'COMP', '小時', FALSE, FALSE, TRUE, '依補休餘額', '當天', TRUE);
