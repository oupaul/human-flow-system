// 薪資異動歷史（僅 admin/hr）。employees.monthlySalary 保留為「目前生效月薪」的快取，
// 特休／補休折現等既有功能直接讀它；真正的資料來源是 employee_compensation，
// 每次異動後（以及每天一次，處理「未來生效」的調薪）重新同步快取。

// 把員工的 employees.monthlySalary 同步成「生效日 <= 今天」的最新一筆；
// 沒傳 employeeId 就同步全部。所有紀錄都還沒生效時不動快取
export async function syncCurrentSalary(pool, employeeId = null) {
  const where = employeeId ? 'AND e.employeeId = ?' : '';
  await pool.execute(
    `UPDATE employees e
     JOIN employee_compensation c ON c.employeeId = e.employeeId
       AND c.effectiveDate = (
         SELECT MAX(c2.effectiveDate) FROM employee_compensation c2
         WHERE c2.employeeId = e.employeeId AND c2.effectiveDate <= CURDATE()
       )
     SET e.monthlySalary = c.monthlySalary
     WHERE 1 = 1 ${where}`,
    employeeId ? [employeeId] : []
  );
}

// 由「員工編輯表單／新增員工」修改月薪時使用：在指定生效日建立（或更新）一筆紀錄。
// 新建時沿用前一筆的投保薪資與眷屬等欄位，避免單純調薪就把投保資料清空
export async function recordSalaryChange(pool, employeeId, monthlySalary, effectiveDate, changedBy, note) {
  const [existing] = await pool.execute(
    'SELECT id FROM employee_compensation WHERE employeeId = ? AND effectiveDate = ?',
    [employeeId, effectiveDate]
  );
  if (existing[0]) {
    await pool.execute(
      'UPDATE employee_compensation SET monthlySalary = ?, changedBy = ? WHERE id = ?',
      [monthlySalary, changedBy, existing[0].id]
    );
  } else {
    const [prev] = await pool.execute(
      `SELECT laborInsuredSalary, healthInsuredSalary, pensionWage, voluntaryPensionRate, healthDependents
       FROM employee_compensation WHERE employeeId = ? AND effectiveDate < ? ORDER BY effectiveDate DESC LIMIT 1`,
      [employeeId, effectiveDate]
    );
    const p = prev[0] || {};
    await pool.execute(
      `INSERT INTO employee_compensation
        (employeeId, effectiveDate, monthlySalary, laborInsuredSalary, healthInsuredSalary, pensionWage,
         voluntaryPensionRate, healthDependents, notes, changedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, effectiveDate, monthlySalary, p.laborInsuredSalary ?? null, p.healthInsuredSalary ?? null,
        p.pensionWage ?? null, p.voluntaryPensionRate ?? null, p.healthDependents ?? null, note || null, changedBy]
    );
  }
  await syncCurrentSalary(pool, employeeId);
}

const toNumberOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

// 驗證並整理表單欄位；回傳 { error } 或 { values }
export function parseCompensation(body) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.effectiveDate || ''))) return { error: '請填寫生效日（YYYY-MM-DD）' };
  const monthlySalary = Number(body.monthlySalary);
  if (!Number.isInteger(monthlySalary) || monthlySalary <= 0) return { error: '月薪必須是大於 0 的整數' };

  const fields = {};
  for (const key of ['laborInsuredSalary', 'healthInsuredSalary', 'pensionWage']) {
    const n = toNumberOrNull(body[key]);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return { error: '投保薪資與提繳工資必須是 0 以上的整數' };
    fields[key] = n;
  }
  const rate = toNumberOrNull(body.voluntaryPensionRate);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 6)) return { error: '自願提繳率必須介於 0 到 6（%）' };
  const dependents = toNumberOrNull(body.healthDependents);
  if (dependents !== null && (!Number.isInteger(dependents) || dependents < 0 || dependents > 20)) return { error: '健保眷屬人數必須是 0 以上的整數' };

  return {
    values: {
      effectiveDate: body.effectiveDate, monthlySalary, ...fields,
      voluntaryPensionRate: rate, healthDependents: dependents, notes: body.notes || null,
    },
  };
}
