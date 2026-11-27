// 系統操作紀錄：誰、什麼時候、從哪個 IP、做了什麼、成功或失敗。
//   * 登入成功／失敗由登入端點明確記錄（見 logAudit）
//   * 登入後所有「新增、修改、刪除」類的請求由 auditMiddleware 自動記錄（不用每個路由各自處理）
//   * 少數敏感的查詢（薪資結算、薪資匯出、員工薪資）也會記錄
//   * 只記錄「做了什麼」與對象編號，不記錄請求內容（密碼、薪資金額等敏感資料不會寫進紀錄）
//   * 只能新增、不能修改；超過保留期限（預設 2 年）的紀錄每天自動清理
//   * 寫入失敗不影響主要操作
// 查詢與匯出只有 admin 可用。

export const AUDIT_RETENTION_DAYS = Math.max(30, Number(process.env.AUDIT_RETENTION_DAYS) || 730);

const CATEGORIES = ['login', 'account', 'employee', 'leave', 'schedule', 'attendance', 'payroll', 'settings', 'other'];

// 路由 → [分類, 說明]。key 是「方法 + 路由樣式」；沒列到的路由會依路徑第一段歸類、說明用路由本身
const CATALOG = {
  'PUT /auth/change-password': ['account', '修改自己的密碼'],
  'PUT /accounts/:id': ['account', '變更帳號角色或啟用狀態'],
  'POST /accounts/:id/reset-password': ['account', '重設帳號密碼'],
  'POST /employees/:id/reset-password': ['account', '重設員工登入密碼'],

  'POST /departments': ['employee', '新增部門'],
  'PUT /departments/:id': ['employee', '修改部門'],
  'DELETE /departments/:id': ['employee', '刪除部門'],
  'POST /employees': ['employee', '新增員工'],
  'POST /employees/import': ['employee', '批次匯入員工'],
  'PUT /employees/:id': ['employee', '修改員工資料'],
  'DELETE /employees/:id': ['employee', '刪除員工'],
  'PUT /employees/:id/terminate': ['employee', '員工離職／復職'],
  'PUT /employees/:id/department': ['employee', '調整員工部門'],

  'POST /leave-types': ['leave', '新增假別'],
  'POST /leave-grants': ['leave', '新增假別核給'],
  'DELETE /leave-grants/:id': ['leave', '刪除假別核給'],
  'POST /leave-applications': ['leave', '送出請假申請'],
  'POST /leave-applications/:id/attachment': ['leave', '上傳請假附件'],
  'PUT /leave-applications/:id/status': ['leave', '審核請假申請'],
  'PUT /leave-balances/:employeeId': ['leave', '調整假期餘額'],
  'POST /leave-balances/recalculate': ['leave', '重新計算假期餘額'],
  'PUT /leave-periods/:id': ['leave', '調整特休週年期間'],
  'POST /leave-periods/:id/settle': ['leave', '特休結算'],
  'POST /leaves/import': ['leave', '批次匯入請假'],
  'POST /overtime-applications': ['leave', '送出加班申請'],
  'PUT /overtime-applications/:id/status': ['leave', '審核加班申請'],
  'POST /comp-time-grants/:id/settle': ['leave', '補休結算'],

  'POST /schedule/shift-types': ['schedule', '新增班別'],
  'PUT /schedule/shift-types/:id': ['schedule', '修改班別'],
  'DELETE /schedule/shift-types/:id': ['schedule', '刪除班別'],
  'PUT /schedule/cells': ['schedule', '儲存班表格子'],
  'POST /schedule/fill': ['schedule', '快速填入班表'],
  'POST /schedule/pattern': ['schedule', '輪替預排'],
  'POST /schedule/coverage': ['schedule', '依需求人數自動排班'],
  'POST /schedule/duty': ['schedule', '值班輪替排班'],
  'POST /schedule/clear-unpublished': ['schedule', '清空未發布的班表'],
  'POST /schedule/publish': ['schedule', '發布班表'],

  'POST /attendance/import': ['attendance', '匯入考勤紀錄'],
  'POST /attendance/punch/events/:id/void': ['attendance', '作廢打卡紀錄'],
  'POST /attendance/punch/correction': ['attendance', '補登打卡'],
  'PUT /attendance/settings': ['attendance', '修改打卡設定'],
  'POST /attendance/devices/:id/:action(approve|revoke)': ['attendance', '核准／撤銷打卡裝置'],
  'PUT /attendance/source': ['attendance', '切換考勤資料來源'],
  'POST /punch-requests/correction': ['attendance', '送出補打卡申請'],
  'POST /punch-requests/correction/:id/review': ['attendance', '審核補打卡申請'],
  'POST /punch-requests/outing': ['attendance', '送出外出申請'],
  'POST /punch-requests/outing/:id/review': ['attendance', '審核外出申請'],
  'POST /attendance/exceptions/run': ['attendance', '執行打卡異常檢查'],

  'POST /seniority-benefits/rules': ['payroll', '新增年資福利規則'],
  'PUT /seniority-benefits/rules/:id': ['payroll', '修改年資福利規則'],
  'DELETE /seniority-benefits/rules/:id': ['payroll', '刪除年資福利規則'],
  'PUT /seniority-benefits/records/:id': ['payroll', '修改年資福利紀錄'],
  'POST /seniority-benefits/check': ['payroll', '執行年資福利檢查'],
  'POST /holiday-benefits/rules': ['payroll', '新增節日福利規則'],
  'PUT /holiday-benefits/rules/:id': ['payroll', '修改節日福利規則'],
  'DELETE /holiday-benefits/rules/:id': ['payroll', '刪除節日福利規則'],
  'POST /holiday-benefits/records': ['payroll', '新增節日福利紀錄'],
  'PUT /holiday-benefits/records/:id': ['payroll', '修改節日福利紀錄'],
  'DELETE /holiday-benefits/records/:id': ['payroll', '刪除節日福利紀錄'],
  'POST /holiday-benefits/check': ['payroll', '執行節日福利檢查'],
  'POST /employees/:employeeId/compensation': ['payroll', '新增員工薪資紀錄'],
  'PUT /compensation/:id': ['payroll', '修改員工薪資紀錄'],
  'DELETE /compensation/:id': ['payroll', '刪除員工薪資紀錄'],
  'PUT /payroll/settings': ['payroll', '修改計薪設定'],
  'POST /payroll/overtime-rules/import': ['payroll', '匯入加班費規則'],
  'PUT /payroll/leave-deductions': ['payroll', '修改請假扣薪設定'],
  'POST /payroll/leave-deductions/prefill': ['payroll', '帶入請假扣薪預設'],
  'POST /payroll/allowance-rules': ['payroll', '新增津貼規則'],
  'PUT /payroll/allowance-rules/:id': ['payroll', '修改津貼規則'],
  'DELETE /payroll/allowance-rules/:id': ['payroll', '刪除津貼規則'],
  'POST /payroll/rates/import': ['payroll', '匯入勞健保費率'],
  'POST /payroll/brackets/import': ['payroll', '匯入投保級距'],
  'POST /payroll/snapshots': ['payroll', '產生薪資結算'],
  'POST /payroll/snapshots/:month/lock': ['payroll', '鎖定薪資結算'],
  'POST /payroll/snapshots/:month/unlock': ['payroll', '解除鎖定薪資結算'],
  'DELETE /payroll/snapshots/:month': ['payroll', '刪除薪資結算'],
  // 敏感查詢
  'GET /payroll/snapshots/:month': ['payroll', '查看薪資結算明細'],
  'GET /payroll/snapshots/:month/export': ['payroll', '匯出薪資結算'],
  'GET /employees/:employeeId/compensation': ['payroll', '查看員工薪資紀錄'],

  'PUT /settings/approval': ['settings', '修改簽核設定（最終簽核者）'],
  'PUT /settings/backup': ['settings', '修改備份設定'],
  'POST /settings/backup/action': ['settings', '測試備份連線或立即備份'],
  'PUT /settings/notifications': ['settings', '修改通知設定'],
  'POST /settings/notifications/test': ['settings', '發送測試通知'],
  'POST /holidays': ['settings', '新增假日'],
  'POST /holidays/sync': ['settings', '同步假日行事曆'],
  'POST /holidays/import': ['settings', '匯入假日'],
  'DELETE /holidays/:id': ['settings', '刪除假日'],
  'PUT /branding/favicon': ['settings', '更新分頁圖示'],
  'PUT /branding/title': ['settings', '更新分頁標題'],
  'DELETE /branding/favicon': ['settings', '還原預設分頁圖示'],
  'GET /audit-logs/export': ['settings', '匯出系統操作紀錄'],
};

// 這些雖然是 POST，但只是試算、預覽或打卡本身（已有專屬紀錄），不記錄
const IGNORED = new Set([
  'POST /schedule/preview', 'POST /schedule/excel-preview', 'POST /payroll/overtime-rules/template', 'POST /attendance/punch',
]);

const FIRST_SEGMENT_CATEGORY = {
  employees: 'employee', departments: 'employee', 'leave-types': 'leave', 'leave-grants': 'leave', 'leave-applications': 'leave', 'leave-balances': 'leave',
  'leave-periods': 'leave', leaves: 'leave', 'overtime-applications': 'leave', 'comp-time-grants': 'leave', schedule: 'schedule',
  attendance: 'attendance', 'punch-requests': 'attendance', payroll: 'payroll', compensation: 'payroll', 'seniority-benefits': 'payroll',
  'holiday-benefits': 'payroll', settings: 'settings', branding: 'settings', holidays: 'settings', accounts: 'account', auth: 'account',
};

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const cut = (v, n) => (v == null ? null : String(v).slice(0, n));

export async function ensureAuditSchema(pool) {
  await pool.execute(`
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
    )`);
}

// 寫一筆紀錄；失敗只印出錯誤，不丟出
export async function logAudit(pool, req, entry) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (actorUsername, actorRole, category, action, summary, targetId, statusCode, success, ip, userAgent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cut(entry.actorUsername ?? req.user?.username, 100), cut(entry.actorRole ?? req.user?.role, 20),
        CATEGORIES.includes(entry.category) ? entry.category : 'other', cut(entry.action, 150), cut(entry.summary, 500) ?? '',
        cut(entry.targetId, 100), entry.statusCode ?? null, entry.success !== false,
        cut(req.ip, 64), cut(req.headers?.['user-agent'], 255),
      ]
    );
  } catch (error) {
    console.error('寫入系統操作紀錄失敗：', error.message);
  }
}

// 登入後的 api 路由自動記錄。放在驗證之後（才知道是誰）、路由之前
export function auditMiddleware(pool) {
  return (req, res, next) => {
    res.on('finish', () => {
      const routePath = req.route?.path;
      if (typeof routePath !== 'string') return;
      const key = `${req.method} ${routePath}`;
      if (IGNORED.has(key)) return;
      const known = CATALOG[key];
      if (!known && !WRITE_METHODS.has(req.method)) return; // 查詢只記錄名單內的敏感項目
      const first = routePath.split('/').filter(Boolean)[0];
      const category = known?.[0] ?? FIRST_SEGMENT_CATEGORY[first] ?? 'other';
      const label = known?.[1] ?? key;

      const params = Object.values(req.params ?? {}).filter((v) => typeof v === 'string' && !['approve', 'revoke'].includes(v));
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const targetId = params[0] ?? (typeof body.employeeId === 'string' ? body.employeeId : null) ?? (typeof body.month === 'string' ? body.month : null);
      const extras = [];
      if (typeof body.from === 'string' && typeof body.to === 'string') extras.push(`${body.from}~${body.to}`);
      if (Array.isArray(body.employeeIds)) extras.push(`${body.employeeIds.length} 人`);
      if (typeof body.department === 'string' && body.department) extras.push(`部門 ${body.department}`);
      const ok = res.statusCode < 400;
      const summary = [label, targetId, extras.length ? `（${extras.join('，')}）` : '', ok ? '' : `失敗（${res.statusCode}）`].filter(Boolean).join(' ');
      logAudit(pool, req, { category, action: key, summary, targetId, statusCode: res.statusCode, success: ok });
    });
    next();
  };
}

export async function purgeOldAuditLogs(pool) {
  try {
    const [r] = await pool.execute('DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [AUDIT_RETENTION_DAYS]);
    if (r.affectedRows > 0) console.log(`已清理 ${r.affectedRows} 筆超過 ${AUDIT_RETENTION_DAYS} 天的系統操作紀錄`);
  } catch (error) {
    console.error('清理系統操作紀錄失敗：', error.message);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const like = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;

function buildFilter(query) {
  const where = [];
  const params = [];
  const from = String(query.from || '');
  const to = String(query.to || '');
  if (DATE_RE.test(from)) { where.push('created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (DATE_RE.test(to)) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }
  const actor = String(query.actor || '').trim();
  if (actor) { where.push('actorUsername LIKE ?'); params.push(like(actor)); }
  const category = String(query.category || '');
  if (CATEGORIES.includes(category)) { where.push('category = ?'); params.push(category); }
  if (query.success === 'true' || query.success === 'false') { where.push('success = ?'); params.push(query.success === 'true'); }
  const q = String(query.q || '').trim();
  if (q) { where.push('(summary LIKE ? OR targetId LIKE ? OR ip LIKE ?)'); params.push(like(q), like(q), like(q)); }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // 避免用 Excel 開啟時被當成公式
  return `"${s.replace(/"/g, '""')}"`;
};

export function registerAuditRoutes(api, { pool, requireRole }) {
  const adminOnly = requireRole('admin');

  api.get('/audit-logs', adminOnly, async (req, res) => {
    try {
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 200);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const { clause, params } = buildFilter(req.query);
      const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${clause}`, params);
      const [rows] = await pool.query(
        `SELECT id, created_at AS createdAt, actorUsername, actorRole, category, action, summary, targetId, statusCode, success, ip
         FROM audit_logs ${clause} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params
      );
      res.json({ rows, total, page, pageSize, retentionDays: AUDIT_RETENTION_DAYS });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: '獲取系統操作紀錄失敗', detail: error.message });
    }
  });

  api.get('/audit-logs/export', adminOnly, async (req, res) => {
    try {
      const { clause, params } = buildFilter(req.query);
      const [rows] = await pool.query(
        `SELECT created_at AS createdAt, actorUsername, actorRole, category, summary, targetId, statusCode, success, ip
         FROM audit_logs ${clause} ORDER BY id DESC LIMIT 20000`, params
      );
      const header = ['時間', '操作者', '角色', '分類', '說明', '對象', '狀態碼', '結果', 'IP'];
      const lines = [header, ...rows.map((r) => [r.createdAt, r.actorUsername, r.actorRole, r.category, r.summary, r.targetId, r.statusCode, r.success ? '成功' : '失敗', r.ip])]
        .map((r) => r.map(csvCell).join(','));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.send(`﻿${lines.join('\r\n')}`);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({ error: '匯出系統操作紀錄失敗', detail: error.message });
    }
  });
}
