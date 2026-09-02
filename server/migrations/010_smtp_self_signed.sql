-- 既有部署（資料庫已存在資料）套用此檔以支援「系統設定 → 通知設定」的
-- 「允許自簽憑證」選項。全新安裝直接用 server/schema.sql 建置即可，不需要
-- 另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/010_smtp_self_signed.sql

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS smtp_allow_self_signed_cert BOOLEAN NOT NULL DEFAULT FALSE;
