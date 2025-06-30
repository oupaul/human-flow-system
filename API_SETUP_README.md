
# ... keep existing code (前置需求和步驟說明)

## 步驟 1: 在 MariaDB 中創建資料表

```sql
CREATE DATABASE IF NOT EXISTS your_database;
USE your_database;

-- ... keep existing code (部門和員工資料表)

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

-- 請假申請表
CREATE TABLE IF NOT EXISTS leave_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId VARCHAR(50) NOT NULL,
  leaveTypeId INT NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  startTime TIME NULL,
  endTime TIME NULL,
  days DECIMAL(3,1) NOT NULL,
  reason TEXT NOT NULL,
  deputy VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approver VARCHAR(255) NULL,
  attachment VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id),
  FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
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

-- 插入範例假別類型
INSERT INTO leave_types (name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit) VALUES
('特休', 'AL', '天', FALSE, FALSE, TRUE, '依年資', '3天', TRUE),
('事假', 'PL', '小時', FALSE, TRUE, FALSE, '14天', '3天', TRUE),
('病假', 'SL', '天', TRUE, FALSE, FALSE, '30天', '當天', TRUE),
('婚假', 'ML', '天', TRUE, FALSE, TRUE, '8天', '7天', FALSE),
('公假', 'OL', '天', TRUE, FALSE, TRUE, '依需求', '3天', TRUE),
('喪假', 'BL', '天', TRUE, FALSE, TRUE, '依親屬關係', '當天', TRUE);

-- 插入範例請假申請
INSERT INTO leave_applications (employeeId, leaveTypeId, startDate, endDate, days, reason, status, approver) VALUES
('EMP001', 1, '2023-05-10', '2023-05-12', 3, '家庭旅遊', 'approved', '李主管'),
('EMP002', 3, '2023-05-15', '2023-05-15', 1, '感冒就醫', 'approved', '王主管'),
('EMP003', 2, '2023-05-18', '2023-05-18', 0.5, '個人事務', 'pending', ''),
('EMP004', 4, '2023-06-01', '2023-06-08', 8, '結婚', 'pending', ''),
('EMP005', 6, '2023-05-20', '2023-05-23', 4, '祖父過世', 'pending', '');

-- 插入範例假別餘額
INSERT INTO leave_balances (employeeId, annualLeave, annualLeaveUsed, sickLeave, sickLeaveUsed, compensatoryLeave, compensatoryLeaveUsed) VALUES
('EMP001', 10, 3, 30, 0, 2, 0),
('EMP002', 7, 0, 30, 1, 0, 0),
('EMP003', 14, 5, 30, 2, 1, 0),
('EMP004', 21, 10, 30, 4, 3, 2),
('EMP005', 3, 0, 30, 0, 0, 0);

-- ... keep existing code (插入範例資料)
```

# ... keep existing code (後續步驟)

## API 端點

### 部門管理
- ... keep existing code (部門 API)

### 員工管理
- ... keep existing code (員工 API)

### 假別管理
- `GET /api/leave-types` - 獲取所有假別類型
- `POST /api/leave-types` - 新增假別類型
- `GET /api/leave-applications` - 獲取所有請假申請
- `POST /api/leave-applications` - 新增請假申請
- `PUT /api/leave-applications/:id/status` - 更新請假申請狀態
- `GET /api/leave-balances` - 獲取所有假別餘額
- `PUT /api/leave-balances/:employeeId` - 更新假別餘額

### Dashboard
- ... keep existing code (Dashboard API)

# ... keep existing code (測試和其他說明)
