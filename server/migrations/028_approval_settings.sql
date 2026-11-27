-- 簽核設定：最終簽核者（管理員與主管的申請由最終簽核者審核）。後端啟動時也會自動建立
CREATE TABLE IF NOT EXISTS approval_settings (
  id TINYINT PRIMARY KEY,
  generalManagerEmployeeId VARCHAR(50) NULL,
  updatedBy VARCHAR(100) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
