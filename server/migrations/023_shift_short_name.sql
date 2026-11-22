-- 班別簡稱：顯示在班表格子裡，沒填就用班別名稱的第一個字。
-- 後端啟動時會自動補上這個欄位，既有部署不必手動套用；這個檔案提供給想預先套用的人。
-- 全新安裝直接用 server/schema.sql 即可。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/023_shift_short_name.sql

ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS shortName VARCHAR(4) NULL AFTER name;
