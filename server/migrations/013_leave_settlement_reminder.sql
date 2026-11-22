-- 既有部署（資料庫已存在資料）套用此檔以支援「特休週年結算提醒」：
-- 記錄每一期特休週年是否已通知過 HR，避免重複提醒。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/013_leave_settlement_reminder.sql

ALTER TABLE leave_periods ADD COLUMN IF NOT EXISTS settlementRemindedAt DATETIME NULL;
