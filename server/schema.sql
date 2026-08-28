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
