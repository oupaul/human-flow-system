// 簽核與部門權限。
//
// 審核規則（請假、加班、補卡、公出）：
//   1. 任何人都不能審核自己的申請
//   2. 管理員（admin）與主管（manager）的申請，由總經理審核
//   3. 總經理自己的申請，由其他管理員審核
//   4. 其他人的申請：管理員、HR、總經理可審；主管只能審同部門
//   尚未設定總經理時，第 2 項改由其他管理員審核，避免申請卡住
//
// 主管（manager 且不是總經理）只能查看與處理同部門的資料。

const STAFF_ROLES = ['admin', 'hr', 'manager'];
const ROLE_RANK = { admin: 4, hr: 3, manager: 2, employee: 1 };

export class AccessError extends Error {
  constructor(message, status = 403, code = 'FORBIDDEN') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const REVIEW_BLOCK_MESSAGES = {
  self: '不能審核自己的申請',
  gm_application: '總經理的申請需由其他管理員審核',
  needs_gm: '管理員與主管的申請需由總經理審核',
  needs_admin: '尚未設定總經理，管理員與主管的申請需由管理員審核',
  other_department: '主管只能審核同部門員工的申請',
  not_staff: '權限不足',
};

export async function ensureApprovalSchema(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS approval_settings (
      id TINYINT PRIMARY KEY,
      generalManagerEmployeeId VARCHAR(50) NULL,
      updatedBy VARCHAR(100) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
}

// 可以擔任總經理的人：在職、有啟用中的管理端帳號（否則進不了審核畫面）
async function listGmCandidates(pool) {
  const [rows] = await pool.execute(
    `SELECT e.employeeId, e.name, e.department, u.role FROM employees e
     JOIN users u ON u.employee_id = e.employeeId AND u.active = TRUE
     WHERE e.active = TRUE AND u.role IN ('admin', 'hr', 'manager') ORDER BY e.employeeId`
  );
  return rows;
}

async function getStoredGmId(pool) {
  const [rows] = await pool.execute('SELECT generalManagerEmployeeId FROM approval_settings WHERE id = 1');
  return rows[0]?.generalManagerEmployeeId ?? null;
}

// 目前有效的總經理；設定的人已離職、停用或被改成一般員工時視為未設定
export async function getGeneralManagerId(pool) {
  const stored = await getStoredGmId(pool);
  if (!stored) return null;
  const candidates = await listGmCandidates(pool);
  return candidates.some((c) => c.employeeId === stored) ? stored : null;
}

// 登入者目前的權限範圍。員工編號與部門每次從資料庫讀，不用 token 裡的舊值
export async function getScope(pool, user) {
  const [rows] = await pool.execute(
    `SELECT u.employee_id AS employeeId, e.department FROM users u
     LEFT JOIN employees e ON e.employeeId = u.employee_id WHERE u.id = ?`, [user.sub]
  );
  const employeeId = rows[0]?.employeeId ?? null;
  const department = rows[0]?.department || null;
  const gmId = await getGeneralManagerId(pool);
  const isGm = !!gmId && employeeId === gmId;
  const restricted = user.role === 'manager' && !isGm;
  let allowed = null; // 只有受限的主管需要
  if (restricted) {
    allowed = new Set();
    if (department) {
      const [members] = await pool.execute('SELECT employeeId FROM employees WHERE department = ?', [department]);
      for (const m of members) allowed.add(m.employeeId);
    }
    if (employeeId) allowed.add(employeeId); // 沒有部門的主管至少看得到自己
  }
  return { role: user.role, employeeId, department, gmId, isGm, restricted, allowed };
}

// 回傳 null 表示可以審核，否則回傳原因代碼
export function reviewBlock(scope, applicant) {
  if (!STAFF_ROLES.includes(scope.role)) return 'not_staff';
  if (scope.employeeId && applicant.employeeId === scope.employeeId) return 'self';
  if (scope.gmId && applicant.employeeId === scope.gmId) return scope.role === 'admin' ? null : 'gm_application';
  if (applicant.role === 'admin' || applicant.role === 'manager') {
    if (scope.gmId) return scope.isGm ? null : 'needs_gm';
    return scope.role === 'admin' ? null : 'needs_admin';
  }
  if (scope.isGm || scope.role === 'admin' || scope.role === 'hr') return null;
  return scope.department && applicant.department === scope.department ? null : 'other_department';
}

// employeeId -> { employeeId, department, role }；一人多個帳號時取權限最高的角色
async function loadApplicants(pool, employeeIds) {
  const map = new Map(employeeIds.map((id) => [id, { employeeId: id, department: null, role: 'employee' }]));
  if (map.size === 0) return map;
  const [rows] = await pool.query(
    `SELECT e.employeeId, e.department, u.role FROM employees e
     LEFT JOIN users u ON u.employee_id = e.employeeId AND u.active = TRUE WHERE e.employeeId IN (?)`, [[...map.keys()]]
  );
  for (const row of rows) {
    const entry = map.get(row.employeeId);
    if (!entry) continue;
    entry.department = row.department;
    if ((ROLE_RANK[row.role] ?? 0) > ROLE_RANK[entry.role]) entry.role = row.role;
  }
  return map;
}

export async function assertCanReview(pool, user, applicantEmployeeId) {
  const scope = await getScope(pool, user);
  const applicants = await loadApplicants(pool, [applicantEmployeeId]);
  const block = reviewBlock(scope, applicants.get(applicantEmployeeId));
  if (block) throw new AccessError(REVIEW_BLOCK_MESSAGES[block], 403, `REVIEW_${block.toUpperCase()}`);
}

// 在申請清單附上目前登入者能不能審核，讓畫面直接說明原因而不是按了才被拒絕
export async function annotateReviewable(pool, user, rows) {
  if (!STAFF_ROLES.includes(user.role)) return rows;
  const scope = await getScope(pool, user);
  const applicants = await loadApplicants(pool, [...new Set(rows.map((r) => r.employeeId))]);
  return rows.map((row) => {
    const block = reviewBlock(scope, applicants.get(row.employeeId));
    return { ...row, reviewable: !block, reviewBlock: block };
  });
}

// 受限主管只能處理同部門員工
export async function assertInScope(pool, user, employeeId) {
  if (user.role !== 'manager') return;
  const scope = await getScope(pool, user);
  if (scope.restricted && !scope.allowed.has(employeeId)) throw new AccessError('主管只能處理同部門員工的資料');
}

// 調整假別額度、補登打卡這類「直接改資料」的動作：不能改自己的，受限主管限同部門
export async function assertCanAdjust(pool, user, employeeId) {
  const scope = await getScope(pool, user);
  if (scope.employeeId && employeeId === scope.employeeId) throw new AccessError('不能調整自己的資料，請由其他管理人員處理', 403, 'SELF_ADJUST');
  if (scope.restricted && !scope.allowed.has(employeeId)) throw new AccessError('主管只能處理同部門員工的資料');
}

// 對某位員工做管理動作（修改、離職、刪除、重設密碼…）的權限。
// sensitive＝會影響對方能否登入或登入身分的動作（重設密碼、改帳號/員工編號、停用、刪除）
export async function assertCanManageEmployee(pool, user, employeeId, { sensitive = true } = {}) {
  if (user.role === 'admin') return;
  const scope = await getScope(pool, user);
  const target = (await loadApplicants(pool, [employeeId])).get(employeeId);
  const isSelf = !!scope.employeeId && employeeId === scope.employeeId;
  if (scope.restricted) {
    if (isSelf) throw new AccessError('主管不能修改自己的員工資料，請洽 HR');
    if (!scope.allowed.has(employeeId)) throw new AccessError('主管只能管理同部門員工');
    if (target.role !== 'employee') throw new AccessError('主管不能管理具有管理權限的帳號');
    return;
  }
  // HR 與兼任總經理的主管：不能透過員工功能接管管理員或總經理的帳號
  if (sensitive && !isSelf && (target.role === 'admin' || employeeId === scope.gmId)) {
    throw new AccessError('只有管理員可以對管理員或總經理的帳號執行這個動作');
  }
}

// 全公司層級的設定與匯入：受限主管不可執行
export const companyWide = (pool) => async (req, res, next) => {
  try {
    if (req.user.role === 'manager' && (await getScope(pool, req.user)).restricted) {
      return res.status(403).json({ error: '這是全公司層級的操作，主管權限不足' });
    }
    next();
  } catch (error) {
    console.error('檢查權限失敗：', error);
    res.status(500).json({ error: '系統發生錯誤' });
  }
};

// 清單裡帶 employeeId 的列，只保留範圍內的
function filterRows(value, allowed) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(item && typeof item === 'object' && 'employeeId' in item && !allowed.has(item.employeeId)))
      .map((item) => filterRows(item, allowed));
  }
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, filterRows(v, allowed)]));
  }
  return value;
}

// 和薪資欄位一樣在 API 出口統一過濾，之後新增的清單路由也不會漏出其他部門的資料。
// 注意：只處理「帶 employeeId 的資料列」；彙總數字（儀表板統計等）與檔案下載不在此列
export const departmentFilter = (pool) => async (req, res, next) => {
  if (req.user.role !== 'manager') return next();
  try {
    const scope = await getScope(pool, req.user);
    if (!scope.restricted) return next();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // 整筆拒絕只用在查詢：寫入路由各自在執行前檢查（執行後才擋會變成「已寫入卻回報失敗」）
      if (req.method === 'GET' && res.statusCode < 400 && body && !Array.isArray(body) && typeof body.employeeId === 'string' && !scope.allowed.has(body.employeeId)) {
        res.status(403);
        return originalJson({ error: '主管只能查看同部門員工的資料' });
      }
      return originalJson(filterRows(body, scope.allowed));
    };
    next();
  } catch (error) {
    console.error('檢查部門權限失敗：', error);
    res.status(500).json({ error: '系統發生錯誤' });
  }
};

// 審核者姓名一律由後端依登入身分填寫
export async function reviewerName(pool, user) {
  const [rows] = await pool.execute(
    'SELECT e.name FROM users u LEFT JOIN employees e ON e.employeeId = u.employee_id WHERE u.id = ?', [user.sub]
  );
  return rows[0]?.name || user.username;
}

export function registerApprovalRoutes(api, { pool, requireRole }) {
  api.get('/settings/approval', requireRole('admin'), async (req, res) => {
    try {
      res.json({
        generalManagerEmployeeId: await getGeneralManagerId(pool),
        storedEmployeeId: await getStoredGmId(pool),
        candidates: await listGmCandidates(pool),
      });
    } catch (error) {
      console.error('Error fetching approval settings:', error);
      res.status(500).json({ error: '取得簽核設定失敗' });
    }
  });

  api.put('/settings/approval', requireRole('admin'), async (req, res) => {
    try {
      const id = req.body.generalManagerEmployeeId || null;
      if (id && !(await listGmCandidates(pool)).some((c) => c.employeeId === id)) {
        return res.status(400).json({ error: '總經理必須是在職、且有管理端帳號（管理員、HR 或主管）的員工' });
      }
      await pool.execute(
        `INSERT INTO approval_settings (id, generalManagerEmployeeId, updatedBy) VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE generalManagerEmployeeId = VALUES(generalManagerEmployeeId), updatedBy = VALUES(updatedBy)`,
        [id, req.user.username]
      );
      res.json({ message: '簽核設定已儲存', generalManagerEmployeeId: id });
    } catch (error) {
      console.error('Error saving approval settings:', error);
      res.status(500).json({ error: '儲存簽核設定失敗' });
    }
  });
}
