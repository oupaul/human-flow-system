-- 既有部署（資料庫已存在資料）套用此檔以支援「特休／補休調整異動記錄」：
-- 記錄誰在什麼時候手動調整了哪位員工的哪項假期資料（變更前後）。
-- 全新安裝直接用 server/schema.sql 建置即可，不需要另外套用這個檔案。
--
-- 用法：
--   docker compose exec -T db mariadb -u root -p"你的DB_ROOT_PASSWORD" hrms_database < server/migrations/016_leave_adjustment_logs.sql

CREATE TABLE IF NOT EXISTS leave_adjustment_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  employeeId VARCHAR(50) NOT NULL,           -- 不設外鍵：員工日後離職或刪除，異動記錄仍要保留
  employeeName VARCHAR(255) NULL,            -- 當時的姓名快照
  action VARCHAR(30) NOT NULL,               -- annual_used、annual_carried_in、annual_granted、annual_settle、comp_settle、sick_balance、grant_create、grant_delete
  refId INT NULL,                            -- 對應的特休週年期間／補休額度／核給紀錄 id
  beforeValue VARCHAR(255) NULL,
  afterValue VARCHAR(255) NULL,
  detail VARCHAR(500) NULL,
  actorUsername VARCHAR(100) NULL,
  actorRole VARCHAR(20) NULL,
  INDEX idx_employee (employeeId),
  INDEX idx_created (created_at)
);
