// 補卡申請與公出申請：員工提出、主管或 HR 核准。
//   補卡：核准後自動補登一筆打卡（source='correction'，留下申請編號與核准者），再重新推算當天出勤。
//   公出：核准期間不算缺卡，當天也可以在允許網路以外打卡。
// 新申請送出時通知 HR（走系統設定的通知通道），與請假、加班申請一致。

import { sendNotification } from './notifications.js';
import { taipeiNow, addCorrection, PunchError } from './punch.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_BACKDATE_DAYS = 31;

async function requireSystemPunchEmployee(pool, employeeId) {
  const [rows] = await pool.execute('SELECT employeeId, name, active, attendanceSource FROM employees WHERE employeeId = ?', [employeeId]);
  const employee = rows[0];
  if (!employee || !employee.active) throw new PunchError(403, 'NO_EMPLOYEE', '此帳號沒有對應的在職員工');
  if (employee.attendanceSource !== 'system') throw new PunchError(403, 'NOT_ENABLED', '您的出勤尚未啟用系統打卡，請洽 HR');
  return employee;
}

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ---- 補卡申請 -------------------------------------------------------------------------

export async function createCorrectionRequest(pool, employeeId, { workDate, type, time, reason }) {
  const employee = await requireSystemPunchEmployee(pool, employeeId);
  const today = taipeiNow().date;
  if (!DATE_RE.test(String(workDate || ''))) throw new PunchError(400, 'BAD_DATE', '日期格式不正確');
  if (workDate > today) throw new PunchError(400, 'FUTURE', '不能申請未來日期的補卡');
  if (workDate < addDays(today, -MAX_BACKDATE_DAYS)) throw new PunchError(400, 'TOO_OLD', `只能申請最近 ${MAX_BACKDATE_DAYS} 天內的補卡，更早的請洽 HR`);
  if (!['in', 'out'].includes(type)) throw new PunchError(400, 'BAD_TYPE', '請選擇上班或下班');
  if (!TIME_RE.test(String(time || ''))) throw new PunchError(400, 'BAD_TIME', '時間格式必須是 HH:MM');
  if (workDate === today && `${workDate} ${time}:00` > taipeiNow().dateTime) throw new PunchError(400, 'FUTURE', '不能申請未來的時間');
  if (!String(reason || '').trim()) throw new PunchError(400, 'REASON_REQUIRED', '請填寫補卡原因');

  const [dup] = await pool.execute(
    `SELECT id FROM punch_correction_requests WHERE employeeId = ? AND workDate = ? AND type = ? AND status = 'pending'`, [employeeId, workDate, type]
  );
  if (dup[0]) throw new PunchError(409, 'DUPLICATE', '這一天同一類型已經有一筆待審核的補卡申請');

  const [result] = await pool.execute(
    `INSERT INTO punch_correction_requests (employeeId, workDate, type, requestedTime, reason) VALUES (?, ?, ?, ?, ?)`,
    [employeeId, workDate, type, `${time}:00`, String(reason).trim().slice(0, 255)]
  );
  await sendNotification(pool, '新的補卡申請', `${employee.name}（${employeeId}）申請補 ${workDate} 的${type === 'in' ? '上班' : '下班'}卡（${time}）。原因：${String(reason).trim()}`);
  return result.insertId;
}

export async function listCorrectionRequests(pool, { employeeId, status }) {
  const where = [];
  const params = [];
  if (employeeId) { where.push('r.employeeId = ?'); params.push(employeeId); }
  if (['pending', 'approved', 'rejected'].includes(status)) { where.push('r.status = ?'); params.push(status); }
  const [rows] = await pool.execute(
    `SELECT r.*, e.name AS employeeName, e.department FROM punch_correction_requests r
     LEFT JOIN employees e ON e.employeeId = r.employeeId ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY FIELD(r.status, 'pending', 'approved', 'rejected'), r.id DESC LIMIT 300`, params
  );
  return rows.map((r) => ({ ...r, requestedTime: String(r.requestedTime).slice(0, 5) }));
}

export async function reviewCorrectionRequest(pool, id, reviewer, { action, note }) {
  const [rows] = await pool.execute('SELECT * FROM punch_correction_requests WHERE id = ?', [id]);
  const request = rows[0];
  if (!request) throw new PunchError(404, 'NOT_FOUND', '找不到該筆補卡申請');
  if (request.status !== 'pending') throw new PunchError(409, 'ALREADY_REVIEWED', '這筆申請已經審核過了');
  if (!['approve', 'reject'].includes(action)) throw new PunchError(400, 'BAD_ACTION', '審核動作不正確');
  if (action === 'reject' && !String(note || '').trim()) throw new PunchError(400, 'NOTE_REQUIRED', '請填寫退回原因');

  if (action === 'approve') {
    // 補登失敗（例如員工已改成外部匯入）就不核准，讓審核者看到原因
    await addCorrection(pool, reviewer, {
      employeeId: request.employeeId, date: request.workDate, time: String(request.requestedTime).slice(0, 5), type: request.type,
      reason: `員工補卡申請 #${id}：${request.reason}`,
    });
  }
  await pool.execute(
    `UPDATE punch_correction_requests SET status = ?, reviewer = ?, reviewNote = ?, reviewedAt = ? WHERE id = ?`,
    [action === 'approve' ? 'approved' : 'rejected', reviewer, String(note || '').trim().slice(0, 255) || null, taipeiNow().dateTime, id]
  );
}

// ---- 公出申請 -------------------------------------------------------------------------

export async function createOutingRequest(pool, employeeId, { startDate, endDate, destination, reason }) {
  const employee = await requireSystemPunchEmployee(pool, employeeId);
  if (!DATE_RE.test(String(startDate || '')) || !DATE_RE.test(String(endDate || '')) || startDate > endDate) throw new PunchError(400, 'BAD_DATE', '日期區間不正確');
  if (endDate < taipeiNow().date) throw new PunchError(400, 'PAST', '不能申請已經結束的公出');
  if (!String(destination || '').trim()) throw new PunchError(400, 'DEST_REQUIRED', '請填寫地點或事由');
  const [overlap] = await pool.execute(
    `SELECT id FROM outing_applications WHERE employeeId = ? AND status IN ('pending', 'approved') AND startDate <= ? AND endDate >= ?`, [employeeId, endDate, startDate]
  );
  if (overlap[0]) throw new PunchError(409, 'OVERLAP', '這段期間已經有公出申請（待審核或已核准）');
  const [result] = await pool.execute(
    `INSERT INTO outing_applications (employeeId, startDate, endDate, destination, reason) VALUES (?, ?, ?, ?, ?)`,
    [employeeId, startDate, endDate, String(destination).trim().slice(0, 255), String(reason || '').trim().slice(0, 255) || null]
  );
  await sendNotification(pool, '新的公出申請', `${employee.name}（${employeeId}）申請公出 ${startDate}${endDate !== startDate ? ` ~ ${endDate}` : ''}：${String(destination).trim()}`);
  return result.insertId;
}

export async function listOutingRequests(pool, { employeeId, status }) {
  const where = [];
  const params = [];
  if (employeeId) { where.push('r.employeeId = ?'); params.push(employeeId); }
  if (['pending', 'approved', 'rejected'].includes(status)) { where.push('r.status = ?'); params.push(status); }
  const [rows] = await pool.execute(
    `SELECT r.*, e.name AS employeeName, e.department FROM outing_applications r
     LEFT JOIN employees e ON e.employeeId = r.employeeId ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY FIELD(r.status, 'pending', 'approved', 'rejected'), r.id DESC LIMIT 300`, params
  );
  return rows;
}

export async function reviewOutingRequest(pool, id, reviewer, { action, note }) {
  const [rows] = await pool.execute('SELECT * FROM outing_applications WHERE id = ?', [id]);
  const request = rows[0];
  if (!request) throw new PunchError(404, 'NOT_FOUND', '找不到該筆公出申請');
  if (request.status !== 'pending') throw new PunchError(409, 'ALREADY_REVIEWED', '這筆申請已經審核過了');
  if (!['approve', 'reject'].includes(action)) throw new PunchError(400, 'BAD_ACTION', '審核動作不正確');
  if (action === 'reject' && !String(note || '').trim()) throw new PunchError(400, 'NOTE_REQUIRED', '請填寫退回原因');
  await pool.execute(
    `UPDATE outing_applications SET status = ?, reviewer = ?, reviewNote = ?, reviewedAt = ? WHERE id = ?`,
    [action === 'approve' ? 'approved' : 'rejected', reviewer, String(note || '').trim().slice(0, 255) || null, taipeiNow().dateTime, id]
  );
}
