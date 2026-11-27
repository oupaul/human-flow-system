// 備份設定與狀態（單一列，id=1）。後端提供設定畫面用的 API；實際備份與上傳由 backupWorker.js
// （docker compose 的 backup 服務）執行，兩邊透過這張表溝通。

export const BACKUP_TIME = process.env.BACKUP_TIME || '02:30';
export const BACKUP_KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS) || 30;

export class BackupError extends Error {}

export async function ensureBackupSchema(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS backup_settings (
      id TINYINT PRIMARY KEY,
      smbEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      smbHost VARCHAR(255) NULL,
      smbShare VARCHAR(80) NULL,
      smbFolder VARCHAR(255) NULL,
      smbUsername VARCHAR(100) NULL,
      smbPassword VARCHAR(255) NULL,
      smbDomain VARCHAR(100) NULL,
      remoteKeepDays INT NOT NULL DEFAULT 90,
      requestedAction VARCHAR(10) NULL,
      requestedAt DATETIME(3) NULL,
      lastBackupAt DATETIME NULL, lastBackupOk BOOLEAN NULL, lastBackupMessage VARCHAR(500) NULL,
      lastUploadAt DATETIME NULL, lastUploadOk BOOLEAN NULL, lastUploadMessage VARCHAR(500) NULL,
      lastTestAt DATETIME NULL, lastTestOk BOOLEAN NULL, lastTestMessage VARCHAR(500) NULL,
      heartbeatAt DATETIME NULL,
      updatedBy VARCHAR(100) NULL
    )`);
  await pool.execute('INSERT IGNORE INTO backup_settings (id) VALUES (1)');
}

export async function readBackupRow(pool) {
  const [rows] = await pool.execute(
    'SELECT *, IFNULL(TIMESTAMPDIFF(SECOND, heartbeatAt, NOW()) < 90, 0) AS workerAlive FROM backup_settings WHERE id = 1'
  );
  return rows[0];
}

// 這些值會放進 smbclient 的指令列與指令字串，只放行不會被解讀成指令的字元
const HOST_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,252}$/;
const NAME_RE = /^[^\\/:*?"<>|;!\x00-\x1f]{1,80}$/;
const CONTROL_RE = /[\x00-\x1f]/;

export function normalizeSmbConfig(input) {
  const host = String(input.smbHost ?? '').trim();
  const share = String(input.smbShare ?? '').trim().replace(/^[\\/]+|[\\/]+$/g, '');
  const folder = String(input.smbFolder ?? '').trim().replace(/\\/g, '/').split('/').map((s) => s.trim()).filter(Boolean);
  let username = String(input.smbUsername ?? '').trim();
  let domain = String(input.smbDomain ?? '').trim();
  const slash = username.indexOf('\\'); // 允許輸入「網域\帳號」
  if (slash > 0) {
    domain = domain || username.slice(0, slash);
    username = username.slice(slash + 1);
  }
  if (host && !HOST_RE.test(host)) throw new BackupError('主機請填 IP 或主機名稱（不要加 \\\\ 或 smb://）');
  if (share && !NAME_RE.test(share)) throw new BackupError('分享資料夾名稱只填第一層名稱，不可含 \\ / : * ? " < > | ; !');
  if (folder.some((s) => s === '.' || s === '..' || !NAME_RE.test(s))) throw new BackupError('子資料夾路徑含有不允許的字元');
  if (folder.join('/').length > 255) throw new BackupError('子資料夾路徑太長');
  if ([username, domain].some((v) => v.length > 100 || CONTROL_RE.test(v))) throw new BackupError('帳號或網域格式不正確');
  return { smbHost: host, smbShare: share, smbFolder: folder.join('/'), smbUsername: username, smbDomain: domain };
}

export const isSmbComplete = (c) => !!(c.smbHost && c.smbShare && c.smbUsername && c.smbPassword);

// 密碼永遠不回傳給前端
function publicView(row) {
  const { smbPassword, workerAlive, requestedAt, heartbeatAt, id, ...rest } = row;
  return {
    ...rest,
    smbEnabled: !!row.smbEnabled,
    lastBackupOk: row.lastBackupOk === null ? null : !!row.lastBackupOk,
    lastUploadOk: row.lastUploadOk === null ? null : !!row.lastUploadOk,
    lastTestOk: row.lastTestOk === null ? null : !!row.lastTestOk,
    hasPassword: !!smbPassword,
    workerAlive: !!Number(workerAlive),
    scheduleTime: BACKUP_TIME,
    localKeepDays: BACKUP_KEEP_DAYS,
  };
}

export function registerBackupRoutes(api, { pool, requireRole }) {
  const adminOnly = requireRole('admin');
  const fail = (res, error, fallback) => {
    if (error instanceof BackupError) return res.status(400).json({ error: error.message });
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
  };

  api.get('/settings/backup', adminOnly, async (req, res) => {
    try { res.json(publicView(await readBackupRow(pool))); } catch (error) { fail(res, error, '取得備份設定失敗'); }
  });

  api.put('/settings/backup', adminOnly, async (req, res) => {
    try {
      const current = await readBackupRow(pool);
      const config = normalizeSmbConfig(req.body);
      const newPassword = String(req.body.smbPassword ?? '');
      if (newPassword.length > 255 || CONTROL_RE.test(newPassword)) throw new BackupError('密碼格式不正確');
      // 換了主機或帳號卻沿用舊密碼，等於把密碼送到別的地方，要求重新輸入
      const targetChanged = !!current.smbPassword && (config.smbHost !== (current.smbHost ?? '') || config.smbUsername !== (current.smbUsername ?? ''));
      if (targetChanged && !newPassword) throw new BackupError('主機或帳號有變更，請重新輸入密碼');
      const password = newPassword || current.smbPassword || '';
      const enabled = !!req.body.smbEnabled;
      if (enabled && !isSmbComplete({ ...config, smbPassword: password })) throw new BackupError('啟用上傳前，請填寫主機、分享資料夾、帳號與密碼');
      const keep = Number(req.body.remoteKeepDays ?? current.remoteKeepDays);
      if (!Number.isInteger(keep) || keep < 1 || keep > 3650) throw new BackupError('遠端保留天數需為 1 到 3650');

      await pool.execute(
        `UPDATE backup_settings SET smbEnabled = ?, smbHost = ?, smbShare = ?, smbFolder = ?, smbUsername = ?, smbPassword = ?, smbDomain = ?,
           remoteKeepDays = ?, updatedBy = ?, lastTestAt = NULL, lastTestOk = NULL, lastTestMessage = NULL WHERE id = 1`,
        [enabled, config.smbHost || null, config.smbShare || null, config.smbFolder || null, config.smbUsername || null, password || null,
          config.smbDomain || null, keep, req.user.username]
      );
      res.json({ message: '備份設定已儲存', ...publicView(await readBackupRow(pool)) });
    } catch (error) { fail(res, error, '儲存備份設定失敗'); }
  });

  // 測試連線／立即備份：寫入要求，由 backup 服務在幾秒內接手
  api.post('/settings/backup/action', adminOnly, async (req, res) => {
    try {
      const action = req.body.action;
      if (!['test', 'backup'].includes(action)) throw new BackupError('不支援的動作');
      const row = await readBackupRow(pool);
      if (!Number(row.workerAlive)) throw new BackupError('備份服務沒有在執行，請在主機上確認 docker compose ps 的 backup 服務');
      if (action === 'test' && !isSmbComplete(row)) throw new BackupError('請先填寫並儲存主機、分享資料夾、帳號與密碼');
      if (row.requestedAction) throw new BackupError('上一個動作還在執行中，請稍候');
      await pool.execute('UPDATE backup_settings SET requestedAction = ?, requestedAt = NOW(3) WHERE id = 1', [action]);
      res.json({ message: action === 'test' ? '已開始測試連線' : '已開始備份' });
    } catch (error) { fail(res, error, '送出備份動作失敗'); }
  });
}
