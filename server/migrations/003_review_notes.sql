-- 既有部署（資料庫已存在資料）套用此檔以支援審核時填寫備註（核准/拒絕皆可）。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/003_review_notes.sql

ALTER TABLE leave_applications ADD COLUMN IF NOT EXISTS reviewNote TEXT NULL;
ALTER TABLE overtime_applications ADD COLUMN IF NOT EXISTS reviewNote TEXT NULL;
