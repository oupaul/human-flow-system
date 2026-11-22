-- 帳號與權限管理的異動記錄。後端第一次用到時會自動建立這張表，既有部署不必手動套用；
-- 這個檔案提供給想預先建立的人。全新安裝直接用 server/schema.sql 即可。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/022_account_audit_logs.sql

CREATE TABLE IF NOT EXISTS account_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  targetUserId INT NULL,                     -- 不設外鍵：帳號日後被刪除，異動記錄仍要保留
  targetUsername VARCHAR(100) NULL,
  action VARCHAR(30) NOT NULL,               -- role_change、activate、deactivate、reset_password
  beforeValue VARCHAR(100) NULL,
  afterValue VARCHAR(100) NULL,
  actorUsername VARCHAR(100) NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_target (targetUserId)
);
