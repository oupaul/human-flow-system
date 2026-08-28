-- 既有部署（資料庫已存在資料）套用此檔以支援員工性別欄位（用於限制生理假僅女性員工
-- 可申請）。全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 既有員工的性別預設為 NULL（未填寫），不會強制回填；未填寫性別的員工申請生理假
-- 時系統不會擋下，請 HR 之後在「員工管理」補上性別資料。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/007_employee_gender.sql

ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender ENUM('male', 'female') NULL;
