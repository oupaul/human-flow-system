-- 員工工時制度：一般工時或二週變形工時（排班檢查依此套用不同規則）。
-- 後端啟動時會自動補上這兩個欄位，既有部署不必手動套用；這個檔案提供給想預先套用的人。
-- 全新安裝直接用 server/schema.sql 即可。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/024_work_time_mode.sql

ALTER TABLE employees ADD COLUMN IF NOT EXISTS workTimeMode VARCHAR(10) NOT NULL DEFAULT 'standard';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS workTimeCycleStart DATE NULL;
