-- 外觀設定：自訂瀏覽器分頁標題（伺服器啟動時也會自動補上這個欄位）
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS siteTitle VARCHAR(100) NULL;
