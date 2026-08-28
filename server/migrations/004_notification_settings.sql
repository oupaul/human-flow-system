-- 既有部署（資料庫已存在資料）套用此檔以支援「設定 → 通知設定」頁面，
-- 通知設定改成存在資料庫、管理者可在網頁上修改，取代舊版純環境變數設定。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/004_notification_settings.sql

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
