// 帳號與權限管理（僅 admin）：列出登入帳號、調整角色、停用/啟用、重設密碼，並留下異動記錄。
//
// 權限即時生效：JWT 裡的角色只代表「登入當下」，所以每次請求都會再查一次帳號目前的角色與啟用狀態
// （短暫快取，帳號一有異動就清除），被降權或停用的人不必等到 token 過期（預設 8 小時）。
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'hr', 'manager', 'employee'];
const CACHE_MS = 5000;
const stateCache = new Map(); // userId -> { at, state }

export function invalidateAccountCache(userId) {
  if (userId === undefined) stateCache.clear();
  else stateCache.delete(Number(userId));
}

// 回傳帳號目前的 { role, active }；查不到回傳 null
export async function getAccountState(pool, userId) {
  const id = Number(userId);
  const cached = stateCache.get(id);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.state;
  const [rows] = await pool.execute('SELECT role, active FROM users WHERE id = ?', [id]);
  const state = rows[0] ? { role: rows[0].role, active: !!rows[0].active } : null;
  stateCache.set(id, { at: Date.now(), state });
  return state;
}

let auditTableReady = null;
// 既有部署不必手動套用 migration：第一次用到時自動建立
function ensureAuditTable(pool) {
  if (!auditTableReady) {
    auditTableReady = pool.execute(`
      CREATE TABLE IF NOT EXISTS account_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        targetUserId INT NULL,
        targetUsername VARCHAR(100) NULL,
        action VARCHAR(30) NOT NULL,
        beforeValue VARCHAR(100) NULL,
        afterValue VARCHAR(100) NULL,
        actorUsername VARCHAR(100) NULL,
        INDEX idx_audit_created (created_at),
        INDEX idx_audit_target (targetUserId)
      )`).catch((e) => { auditTableReady = null; throw e; });
  }
  return auditTableReady;
}

async function writeAudit(pool, { targetUserId, targetUsername, action, beforeValue = null, afterValue = null, actorUsername }) {
  await ensureAuditTable(pool);
  await pool.execute(
    `INSERT INTO account_audit_logs (targetUserId, targetUsername, action, beforeValue, afterValue, actorUsername)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [targetUserId, targetUsername, action, beforeValue, afterValue, actorUsername]
  );
}

function randomPassword() {
  // 排除容易看錯的字元（0/O、1/l/I）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (const b of crypto.randomBytes(12)) out += chars[b % chars.length];
  return out;
}

export function registerAccountRoutes(api, { pool, requireRole }) {
  const adminOnly = requireRole('admin');

  api.get('/accounts', adminOnly, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.role, u.employee_id AS employeeId, u.active, u.mustChangePassword,
                u.created_at AS createdAt, e.name AS employeeName
         FROM users u LEFT JOIN employees e ON u.employee_id = e.employeeId
         ORDER BY FIELD(u.role, 'admin', 'hr', 'manager', 'employee'), u.username`
      );
      res.json(rows.map((r) => ({ ...r, active: !!r.active, mustChangePassword: !!r.mustChangePassword })));
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: '獲取帳號列表失敗', detail: error.message });
    }
  });

  api.put('/accounts/:id', adminOnly, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { role, active } = req.body || {};
      if (role === undefined && active === undefined) {
        return res.status(400).json({ error: '沒有要修改的內容' });
      }
      if (role !== undefined && !ROLES.includes(role)) {
        return res.status(400).json({ error: '角色不正確' });
      }
      if (active !== undefined && typeof active !== 'boolean') {
        return res.status(400).json({ error: '啟用狀態不正確' });
      }

      const [rows] = await pool.execute('SELECT id, username, role, active FROM users WHERE id = ?', [id]);
      const target = rows[0];
      if (!target) return res.status(404).json({ error: '找不到帳號' });

      const newRole = role ?? target.role;
      const newActive = active ?? !!target.active;
      const roleChanged = newRole !== target.role;
      const activeChanged = newActive !== !!target.active;
      if (!roleChanged && !activeChanged) {
        return res.json({ message: '沒有變更' });
      }

      if (id === Number(req.user.sub)) {
        return res.status(400).json({ error: '不能修改自己的角色或停用自己的帳號，請由其他管理員操作', code: 'SELF_MODIFY' });
      }

      // 至少要保留一個「啟用中」的管理員，否則沒人能再進來調整權限
      const losesAdmin = target.role === 'admin' && !!target.active && (newRole !== 'admin' || !newActive);
      if (losesAdmin) {
        const [[{ n }]] = await pool.execute(
          `SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = TRUE AND id <> ?`, [id]
        );
        if (n < 1) {
          return res.status(400).json({ error: '至少要保留一個啟用中的管理員帳號', code: 'LAST_ADMIN' });
        }
      }

      await pool.execute('UPDATE users SET role = ?, active = ? WHERE id = ?', [newRole, newActive, id]);
      invalidateAccountCache(id);

      const actorUsername = req.user.username;
      if (roleChanged) {
        await writeAudit(pool, { targetUserId: id, targetUsername: target.username, action: 'role_change', beforeValue: target.role, afterValue: newRole, actorUsername });
      }
      if (activeChanged) {
        await writeAudit(pool, { targetUserId: id, targetUsername: target.username, action: newActive ? 'activate' : 'deactivate', actorUsername });
      }
      res.json({ message: '帳號已更新' });
    } catch (error) {
      console.error('Error updating account:', error);
      res.status(500).json({ error: '更新帳號失敗', detail: error.message });
    }
  });

  // 重設密碼：員工帳號重設為員工編號（與員工管理的「重設密碼」相同）；
  // 沒有對應員工的帳號（如初始 admin）產生一組隨機臨時密碼，只在這次回應顯示
  api.post('/accounts/:id/reset-password', adminOnly, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (id === Number(req.user.sub)) {
        return res.status(400).json({ error: '要修改自己的密碼請到「個人設定」', code: 'SELF_MODIFY' });
      }
      const [rows] = await pool.execute('SELECT id, username, employee_id FROM users WHERE id = ?', [id]);
      const target = rows[0];
      if (!target) return res.status(404).json({ error: '找不到帳號' });

      const temporaryPassword = target.employee_id || randomPassword();
      const hash = await bcrypt.hash(temporaryPassword, 10);
      await pool.execute('UPDATE users SET password_hash = ?, mustChangePassword = TRUE WHERE id = ?', [hash, id]);
      await writeAudit(pool, { targetUserId: id, targetUsername: target.username, action: 'reset_password', actorUsername: req.user.username });
      res.json({ message: '密碼已重設', username: target.username, temporaryPassword });
    } catch (error) {
      console.error('Error resetting account password:', error);
      res.status(500).json({ error: '重設密碼失敗', detail: error.message });
    }
  });

  api.get('/accounts/audit', adminOnly, async (req, res) => {
    try {
      await ensureAuditTable(pool);
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const q = String(req.query.q || '').trim();
      const where = q ? 'WHERE targetUsername LIKE ? OR actorUsername LIKE ?' : '';
      const params = q ? [`%${q}%`, `%${q}%`] : [];
      const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM account_audit_logs ${where}`, params);
      const [rows] = await pool.query(
        `SELECT id, created_at AS createdAt, targetUsername, action, beforeValue, afterValue, actorUsername
         FROM account_audit_logs ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, params
      );
      res.json({ rows, total });
    } catch (error) {
      console.error('Error fetching account audit logs:', error);
      res.status(500).json({ error: '獲取異動記錄失敗', detail: error.message });
    }
  });
}
