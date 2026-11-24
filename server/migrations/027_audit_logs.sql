-- 系統操作紀錄：誰、什麼時候、從哪個 IP、做了什麼。只新增、不修改；超過保留期限（預設 2 年）自動清理
-- （伺服器啟動時也會自動建立這張表）
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actorUsername VARCHAR(100) NULL,
  actorRole VARCHAR(20) NULL,
  category VARCHAR(20) NOT NULL,
  action VARCHAR(150) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  targetId VARCHAR(100) NULL,
  statusCode SMALLINT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  ip VARCHAR(64) NULL,
  userAgent VARCHAR(255) NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actorUsername),
  INDEX idx_audit_category (category)
);
