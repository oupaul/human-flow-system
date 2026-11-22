// 特休／補休等假期資料的「手動調整」異動記錄：誰、什麼時候、調整了哪位員工的什麼、變更前後。
// 只記錄人為調整（調整已用／遞延天數、重新計算、結算、補休結算、病假餘額調整、額度核給與刪除），
// 請假核准扣抵、加班產生補休這類系統自動變動不在此列。
// 為了不讓稽核寫入的問題擋住正常業務，寫入失敗只記 log 不拋例外。
// 記錄內容刻意不含任何金額（折現金額等），避免無薪資權限的角色從這裡看到薪資。

export const LEAVE_ADJUSTMENT_ACTIONS = [
  'annual_used', 'annual_carried_in', 'annual_granted', 'annual_settle',
  'comp_settle', 'sick_balance', 'grant_create', 'grant_delete',
];

export async function logLeaveAdjustment(pool, actor, { employeeId, action, refId = null, before = null, after = null, detail = null }) {
  try {
    const [rows] = await pool.execute('SELECT name FROM employees WHERE employeeId = ?', [employeeId]);
    await pool.execute(
      `INSERT INTO leave_adjustment_logs (employeeId, employeeName, action, refId, beforeValue, afterValue, detail, actorUsername, actorRole)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, rows[0]?.name ?? null, action, refId, before === null ? null : String(before), after === null ? null : String(after),
        detail, actor?.username ?? null, actor?.role ?? null]
    );
  } catch (error) {
    console.error('[leaveAudit] 寫入異動記錄失敗：', error.message);
  }
}

export async function listLeaveAdjustments(pool, { q, action, limit = 100, offset = 0 }) {
  const where = [];
  const params = [];
  if (q) {
    where.push('(employeeId LIKE ? OR employeeName LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (action && LEAVE_ADJUSTMENT_ACTIONS.includes(action)) {
    where.push('action = ?');
    params.push(action);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM leave_adjustment_logs ${clause}`, params);
  // LIMIT/OFFSET 已經過上面的數值轉換與範圍限制，直接串進 SQL 是安全的
  const [rows] = await pool.query(
    `SELECT * FROM leave_adjustment_logs ${clause} ORDER BY id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );
  return { total, rows };
}
