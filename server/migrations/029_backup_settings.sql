-- 備份設定與狀態（NAS 的 SMB 上傳）。後端與備份服務啟動時也會自動建立
CREATE TABLE IF NOT EXISTS backup_settings (
  id TINYINT PRIMARY KEY,
  smbEnabled BOOLEAN NOT NULL DEFAULT FALSE,
  smbHost VARCHAR(255) NULL,
  smbShare VARCHAR(80) NULL,
  smbFolder VARCHAR(255) NULL,
  smbUsername VARCHAR(100) NULL,
  smbPassword VARCHAR(255) NULL,
  smbDomain VARCHAR(100) NULL,
  remoteKeepDays INT NOT NULL DEFAULT 90,
  requestedAction VARCHAR(10) NULL,
  requestedAt DATETIME(3) NULL,
  lastBackupAt DATETIME NULL, lastBackupOk BOOLEAN NULL, lastBackupMessage VARCHAR(500) NULL,
  lastUploadAt DATETIME NULL, lastUploadOk BOOLEAN NULL, lastUploadMessage VARCHAR(500) NULL,
  lastTestAt DATETIME NULL, lastTestOk BOOLEAN NULL, lastTestMessage VARCHAR(500) NULL,
  heartbeatAt DATETIME NULL,
  updatedBy VARCHAR(100) NULL
);
INSERT IGNORE INTO backup_settings (id) VALUES (1);
