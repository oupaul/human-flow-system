// 外觀設定：自訂瀏覽器分頁圖示（favicon）。
//   * 圖片存在資料庫（容器重建、換主機都不會遺失）；未上傳時前端沿用預設的 /favicon.ico
//   * 讀取是公開的（登入頁也要顯示圖示），上傳與還原只有 admin
//   * 以檔案內容（檔頭）判斷格式，不信任副檔名與 Content-Type
export const MAX_FAVICON_BYTES = 256 * 1024;

export class BrandingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function ensureBrandingSchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS branding_settings (
    id INT PRIMARY KEY DEFAULT 1,
    faviconData MEDIUMBLOB NULL,
    faviconType VARCHAR(50) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.query('INSERT IGNORE INTO branding_settings (id) VALUES (1)');
}

// 回傳 MIME 類型；不是支援的圖片就回傳 null
export function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0) return 'image/x-icon';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  const head = buffer.subarray(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'image/svg+xml';
  return null;
}

export async function getBranding(pool) {
  const [[row]] = await pool.query('SELECT faviconType IS NOT NULL AS has, UNIX_TIMESTAMP(updated_at) AS version FROM branding_settings WHERE id = 1');
  return { hasFavicon: !!row?.has, version: Number(row?.version) || 0 };
}

export async function getFavicon(pool) {
  const [[row]] = await pool.query('SELECT faviconData, faviconType FROM branding_settings WHERE id = 1');
  return row?.faviconData ? { data: row.faviconData, type: row.faviconType } : null;
}

export async function setFavicon(pool, buffer) {
  if (!buffer?.length) throw new BrandingError(400, '請選擇要上傳的圖片');
  if (buffer.length > MAX_FAVICON_BYTES) throw new BrandingError(400, `圖片太大（上限 ${MAX_FAVICON_BYTES / 1024} KB）`);
  const type = detectImageType(buffer);
  if (!type) throw new BrandingError(400, '不支援的圖片格式，請上傳 PNG、ICO、SVG、JPG 或 WEBP');
  await pool.execute('UPDATE branding_settings SET faviconData = ?, faviconType = ? WHERE id = 1', [buffer, type]);
  return type;
}

export async function clearFavicon(pool) {
  await pool.execute('UPDATE branding_settings SET faviconData = NULL, faviconType = NULL WHERE id = 1');
}
