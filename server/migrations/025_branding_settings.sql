-- 外觀設定：自訂瀏覽器分頁圖示（伺服器啟動時也會自動建立，這份供手動升級參考）
CREATE TABLE IF NOT EXISTS branding_settings (
  id INT PRIMARY KEY DEFAULT 1,
  faviconData MEDIUMBLOB NULL,
  faviconType VARCHAR(50) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO branding_settings (id) VALUES (1);
