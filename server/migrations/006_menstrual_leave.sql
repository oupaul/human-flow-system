-- 既有部署（資料庫已存在資料）套用此檔以補上「生理假」假別。全新安裝直接用
-- server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/006_menstrual_leave.sql

INSERT IGNORE INTO leave_types (name, code, unit, needProof, affectAttendance, isPaid, maxDays, advanceApply, canSplit)
VALUES ('生理假', 'MSL', '天', FALSE, FALSE, FALSE, '每月1日，全年前3日不併入病假計算（依性別工作平等法第14條，皆為半薪）', '當天', TRUE);
