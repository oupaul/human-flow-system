// 自建打卡（階段 A）：網頁上下班打卡、打卡事件（只新增）、每日出勤推算、IP 限制、裝置綁定。
//
// 設計原則：
//   * 時間一律取伺服器台北時間，不信任用戶端；上班／下班由使用者指定，但伺服器會檢查狀態（不能連按兩次上班）。
//   * 打卡事件只新增不修改；更正＝作廢原事件（保留原因）＋視需要補登。勞基法要求出勤紀錄保存 5 年，所以不提供刪除。
//   * attendance_records（每日出勤）由有效事件推算，現有的出勤報表與排班制薪資繼續讀這張表；
//     employees.attendanceSource='system' 的員工才使用系統打卡，外部匯入會略過他們。
//   * 裝置綁定是「瀏覽器層級」：網頁拿不到硬體 MAC 位址（瀏覽器不開放、伺服器也只看得到 IP、手機還會隨機化 MAC），
//     所以改用每個瀏覽器的隨機識別碼，登記在某位員工名下；同一個識別碼不能替兩個人打卡。

import crypto from 'crypto';
import { getScheduleForDay, OFF_LABELS } from './schedule.js';

export class PunchError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// ---- 台北時間 -------------------------------------------------------------------------

const taipeiFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export function taipeiNow(date = new Date()) {
  const p = Object.fromEntries(taipeiFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}`, dateTime: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}` };
}

// ---- IP 限制 --------------------------------------------------------------------------

export function normalizeIp(ip) {
  const value = String(ip || '').trim();
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    n = n * 256 + Number(part);
  }
  return n;
}

// 允許清單每行一個 IPv4 位址或 CIDR 網段（如 203.0.113.0/24）；空清單＝不限制。IPv6 不支援（不在清單內視為不允許）
export function parseAllowlist(text) {
  const entries = [];
  const errors = [];
  for (const raw of String(text || '').split(/[\r\n,]+/)) {
    const line = raw.trim();
    if (!line) continue;
    const [address, bitsRaw] = line.split('/');
    const base = ipv4ToInt(address);
    const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
    if (base === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      errors.push(line);
      continue;
    }
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    entries.push({ base: (base & mask) >>> 0, mask });
  }
  return { entries, errors };
}

export function ipAllowed(ip, allowlistText) {
  const { entries } = parseAllowlist(allowlistText);
  if (entries.length === 0) return true;
  const n = ipv4ToInt(normalizeIp(ip));
  if (n === null) return false;
  return entries.some((e) => ((n & e.mask) >>> 0) === e.base);
}

// ---- 設定 -----------------------------------------------------------------------------

export async function getAttendanceSettings(pool) {
  const [rows] = await pool.execute('SELECT * FROM attendance_settings WHERE id = 1');
  const r = rows[0] || {};
  return {
    defaultShiftStart: String(r.defaultShiftStart || '09:00:00').slice(0, 5),
    defaultShiftEnd: String(r.defaultShiftEnd || '18:00:00').slice(0, 5),
    ipAllowlist: r.ipAllowlist || '',
    deviceBinding: r.deviceBinding || 'enforce',
    maxDevicesPerEmployee: r.maxDevicesPerEmployee ?? 2,
    defaultBreakMinutes: r.defaultBreakMinutes ?? 60,
    autoApproveFirstDevice: r.autoApproveFirstDevice === undefined ? true : !!r.autoApproveFirstDevice,
  };
}

export async function saveAttendanceSettings(pool, body) {
  const timeRe = /^\d{2}:\d{2}$/;
  if (!timeRe.test(String(body.defaultShiftStart)) || !timeRe.test(String(body.defaultShiftEnd))) throw new Error('預設班別時間格式必須是 HH:MM');
  const { errors } = parseAllowlist(body.ipAllowlist);
  if (errors.length > 0) throw new Error(`以下 IP 或網段格式不正確：${errors.join('、')}（僅支援 IPv4，例如 203.0.113.5 或 203.0.113.0/24）`);
  if (!['off', 'flag', 'enforce'].includes(body.deviceBinding)) throw new Error('裝置綁定模式不正確');
  const max = Number(body.maxDevicesPerEmployee);
  if (!Number.isInteger(max) || max < 1 || max > 10) throw new Error('每位員工裝置上限必須是 1 到 10 的整數');
  const breakMinutes = Number(body.defaultBreakMinutes ?? 60);
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) throw new Error('預設休息時間必須是 0 到 240 分鐘的整數');
  await pool.execute(
    `UPDATE attendance_settings SET defaultShiftStart = ?, defaultShiftEnd = ?, ipAllowlist = ?, deviceBinding = ?,
       maxDevicesPerEmployee = ?, autoApproveFirstDevice = ?, defaultBreakMinutes = ? WHERE id = 1`,
    [`${body.defaultShiftStart}:00`, `${body.defaultShiftEnd}:00`, String(body.ipAllowlist || '').trim() || null, body.deviceBinding, max, body.autoApproveFirstDevice !== false, breakMinutes]
  );
}

// ---- 每日出勤推算 -----------------------------------------------------------------------

// 由某員工某工作日的有效打卡事件推算 attendance_records：最早的上班＝簽到、最晚的下班＝簽退；
// 兩者都有＝normal，缺其中一個＝missing（當天還在進行中標註「進行中」）；沒有任何有效事件就移除系統產生的那一筆
export async function recomputeDay(pool, employeeId, workDate) {
  const [events] = await pool.execute(
    `SELECT type, punchAt FROM punch_events WHERE employeeId = ? AND workDate = ? AND status = 'valid' ORDER BY punchAt`,
    [employeeId, workDate]
  );
  if (events.length === 0) {
    await pool.execute(`DELETE FROM attendance_records WHERE employeeId = ? AND date = ? AND source = 'system'`, [employeeId, workDate]);
    return null;
  }
  const ins = events.filter((e) => e.type === 'in');
  const outs = events.filter((e) => e.type === 'out');
  const timeOf = (e) => String(e.punchAt).slice(11, 19);
  const clockIn = ins.length > 0 ? timeOf(ins[0]) : null;
  const lastOut = outs.length > 0 ? outs[outs.length - 1] : null;
  const clockOut = lastOut && (!ins[0] || String(lastOut.punchAt) > String(ins[0].punchAt)) ? timeOf(lastOut) : null;
  const settings = await getAttendanceSettings(pool);
  // 班別：有班表就用班表（上班＝該班別時間；排休日出勤沒有班別，不算遲到早退），沒有班表用預設班別
  const sched = await getScheduleForDay(pool, employeeId, workDate);
  let shiftStart = `${settings.defaultShiftStart}:00`;
  let shiftEnd = `${settings.defaultShiftEnd}:00`;
  let scheduleNote = null;
  if (sched?.kind === 'shift') {
    shiftStart = `${sched.startTime}:00`;
    shiftEnd = `${sched.endTime}:00`;
  } else if (sched?.kind === 'off') {
    shiftStart = null;
    shiftEnd = null;
    scheduleNote = `${OFF_LABELS[sched.offType]}出勤`;
  }
  const status = clockIn && clockOut ? 'normal' : 'missing';
  const inProgress = status === 'missing' && workDate === taipeiNow().date && clockIn && !clockOut;
  const note = inProgress ? '進行中' : scheduleNote;
  await pool.execute(
    `INSERT INTO attendance_records (employeeId, date, shiftStart, shiftEnd, clockIn, clockOut, status, note, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'system')
     ON DUPLICATE KEY UPDATE shiftStart = VALUES(shiftStart), shiftEnd = VALUES(shiftEnd), clockIn = VALUES(clockIn),
       clockOut = VALUES(clockOut), status = VALUES(status), note = VALUES(note), source = 'system'`,
    [employeeId, workDate, shiftStart, shiftEnd, clockIn, clockOut, status, note]
  );
  return { clockIn, clockOut, status };
}

// ---- 裝置 -----------------------------------------------------------------------------

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function deviceLabel(userAgent) {
  const ua = String(userAgent || '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '瀏覽器';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return `${browser}${os ? ` / ${os}` : ''}`;
}

// 依設定模式檢查（必要時登記）裝置，回傳 { deviceId, flags[] }；enforce 模式下不合規會丟出 PunchError
async function checkDevice(pool, settings, employeeId, deviceToken, ip, userAgent, now) {
  const flags = [];
  if (settings.deviceBinding === 'off') return { deviceId: null, flags };
  if (!deviceToken || String(deviceToken).length < 16) {
    if (settings.deviceBinding === 'enforce') throw new PunchError(400, 'DEVICE_MISSING', '無法識別此裝置，請重新整理頁面後再試');
    return { deviceId: null, flags: ['no_device_id'] };
  }
  const tokenHash = hashToken(deviceToken);
  const enforce = settings.deviceBinding === 'enforce';
  const [rows] = await pool.execute('SELECT * FROM punch_devices WHERE tokenHash = ?', [tokenHash]);
  let device = rows[0];

  if (device && device.employeeId !== employeeId) {
    flags.push('device_other_employee');
    if (enforce) throw new PunchError(403, 'DEVICE_OTHER', '此裝置已綁定給其他員工，不能替他人打卡；如裝置確實換人使用，請洽 HR 停用原綁定');
    return { deviceId: device.id, flags };
  }

  if (!device) {
    const [[{ active }]] = await pool.execute(
      `SELECT COUNT(*) AS active FROM punch_devices WHERE employeeId = ? AND status IN ('pending', 'approved')`, [employeeId]
    );
    const [[{ approved }]] = await pool.execute(
      `SELECT COUNT(*) AS approved FROM punch_devices WHERE employeeId = ? AND status = 'approved'`, [employeeId]
    );
    if (enforce && active >= settings.maxDevicesPerEmployee) {
      throw new PunchError(403, 'DEVICE_LIMIT', `您已登記 ${active} 台裝置（上限 ${settings.maxDevicesPerEmployee}），請洽 HR 停用舊裝置後再使用新裝置`);
    }
    const autoApprove = !enforce || (settings.autoApproveFirstDevice && approved === 0);
    const status = autoApprove ? 'approved' : 'pending';
    const [result] = await pool.execute(
      `INSERT INTO punch_devices (employeeId, tokenHash, label, status, firstSeenAt, lastSeenAt, lastIp, approvedBy, approvedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, tokenHash, deviceLabel(userAgent), status, now, now, ip, autoApprove ? '系統（自動）' : null, autoApprove ? now : null]
    );
    device = { id: result.insertId, status };
    if (!enforce) flags.push('new_device');
  } else {
    await pool.execute('UPDATE punch_devices SET lastSeenAt = ?, lastIp = ? WHERE id = ?', [now, ip, device.id]);
  }

  if (device.status === 'pending') {
    if (enforce) throw new PunchError(403, 'DEVICE_PENDING', '這是新裝置，已送出綁定申請，請洽 HR 核准後再打卡');
    flags.push('device_pending');
  } else if (device.status === 'revoked') {
    if (enforce) throw new PunchError(403, 'DEVICE_REVOKED', '此裝置的綁定已被停用，請洽 HR');
    flags.push('device_revoked');
  }
  return { deviceId: device.id, flags };
}

// ---- 打卡 -----------------------------------------------------------------------------

// 今天（含）落在已核准公出期間內：可在允許網路以外打卡（外出洽公、出差本來就不在公司）
async function hasApprovedOutingOn(pool, employeeId, date) {
  const [rows] = await pool.execute(
    `SELECT id FROM outing_applications WHERE employeeId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ? LIMIT 1`,
    [employeeId, date, date]
  );
  return rows.length > 0;
}

async function getEmployee(pool, employeeId) {
  const [rows] = await pool.execute(
    'SELECT employeeId, name, active, attendanceSource, punchIpExempt FROM employees WHERE employeeId = ?', [employeeId]
  );
  return rows[0] || null;
}

// 找出「未結束的上班」：近 20 小時內最後一筆有效事件是上班（沒有對應下班），涵蓋跨夜班
async function findOpenSession(pool, employeeId, nowDateTime) {
  const [rows] = await pool.execute(
    `SELECT id, type, punchAt, workDate FROM punch_events
     WHERE employeeId = ? AND status = 'valid' AND punchAt >= DATE_SUB(?, INTERVAL 20 HOUR)
     ORDER BY punchAt DESC, id DESC LIMIT 1`,
    [employeeId, nowDateTime]
  );
  const last = rows[0] || null;
  return { last, open: last && last.type === 'in' ? last : null };
}

export async function getPunchStatus(pool, user, { ip, deviceToken }) {
  const employee = user.employeeId ? await getEmployee(pool, user.employeeId) : null;
  const now = taipeiNow();
  const settings = await getAttendanceSettings(pool);
  const base = { serverTime: now.dateTime, today: now.date, ip: normalizeIp(ip) };
  if (!employee || !employee.active) return { ...base, enabled: false, reason: 'NO_EMPLOYEE' };
  if (employee.attendanceSource !== 'system') return { ...base, enabled: false, reason: 'NOT_ENABLED' };

  const { last, open } = await findOpenSession(pool, employee.employeeId, now.dateTime);
  const [events] = await pool.execute(
    `SELECT type, punchAt FROM punch_events WHERE employeeId = ? AND workDate = ? AND status = 'valid' ORDER BY punchAt`,
    [employee.employeeId, open ? open.workDate : now.date]
  );
  const ipOk = employee.punchIpExempt || ipAllowed(ip, settings.ipAllowlist) || (await hasApprovedOutingOn(pool, employee.employeeId, now.date));
  let deviceState = 'off';
  if (settings.deviceBinding !== 'off') {
    deviceState = 'unknown';
    if (deviceToken && String(deviceToken).length >= 16) {
      const [rows] = await pool.execute('SELECT employeeId, status FROM punch_devices WHERE tokenHash = ?', [hashToken(deviceToken)]);
      const d = rows[0];
      deviceState = !d ? 'unknown' : d.employeeId !== employee.employeeId ? 'other' : d.status;
    }
  }
  return {
    ...base, enabled: true, name: employee.name,
    nextType: open ? 'out' : 'in',
    open: !!open, lastPunchAt: last ? String(last.punchAt) : null,
    todayEvents: events.map((e) => ({ type: e.type, time: String(e.punchAt).slice(11, 19) })),
    ipAllowed: ipOk, deviceBinding: settings.deviceBinding, deviceState,
  };
}

// 對外的打卡入口：失敗時（IP 不符、裝置未核准…）先記一筆拒絕紀錄再把錯誤丟回去。
// 記錄失敗只寫 log，不能影響打卡本身的回應
export async function punch(pool, user, context) {
  try {
    return await punchInner(pool, user, context);
  } catch (error) {
    if (error instanceof PunchError) {
      try {
        await pool.execute(
          `INSERT INTO punch_rejections (employeeId, attemptedAt, type, code, ip, deviceLabel) VALUES (?, ?, ?, ?, ?, ?)`,
          [user?.employeeId ?? null, taipeiNow().dateTime, ['in', 'out'].includes(context?.type) ? context.type : null, error.code,
            normalizeIp(context?.ip) || null, deviceLabel(context?.userAgent)]
        );
      } catch (logError) {
        console.error('[punch] 寫入拒絕紀錄失敗：', logError.message);
      }
    }
    throw error;
  }
}

async function punchInner(pool, user, { type, ip, userAgent, deviceToken }) {
  if (!['in', 'out'].includes(type)) throw new PunchError(400, 'BAD_TYPE', '打卡類型不正確');
  const employee = user.employeeId ? await getEmployee(pool, user.employeeId) : null;
  if (!employee || !employee.active) throw new PunchError(403, 'NO_EMPLOYEE', '此帳號沒有對應的在職員工，無法打卡');
  if (employee.attendanceSource !== 'system') throw new PunchError(403, 'NOT_ENABLED', '您的出勤尚未啟用系統打卡，請洽 HR');

  const settings = await getAttendanceSettings(pool);
  const cleanIp = normalizeIp(ip);
  const now = taipeiNow();
  const outing = !employee.punchIpExempt && !ipAllowed(cleanIp, settings.ipAllowlist) ? await hasApprovedOutingOn(pool, employee.employeeId, now.date) : false;
  if (!employee.punchIpExempt && !outing && !ipAllowed(cleanIp, settings.ipAllowlist)) {
    throw new PunchError(403, 'IP_BLOCKED', `目前的網路不在允許打卡的範圍內（您的 IP：${cleanIp || '未知'}）；如果是外出洽公，請先申請公出`);
  }
  const device = await checkDevice(pool, settings, employee.employeeId, deviceToken, cleanIp, userAgent, now.dateTime);

  const { last, open } = await findOpenSession(pool, employee.employeeId, now.dateTime);
  if (type === 'in' && open) throw new PunchError(409, 'ALREADY_IN', '您已經打過上班卡，請改按「下班打卡」');
  if (type === 'out' && !open) throw new PunchError(409, 'NOT_IN', '目前沒有上班中的紀錄，請先按「上班打卡」');
  if (last && last.type === type && (Date.parse(now.dateTime.replace(' ', 'T')) - Date.parse(String(last.punchAt).replace(' ', 'T'))) < 60000) {
    throw new PunchError(409, 'TOO_FAST', '剛剛已經打過卡了，請稍候');
  }

  const workDate = type === 'out' ? open.workDate : now.date;
  const allFlags = outing ? [...device.flags, 'outing'] : device.flags;
  const flags = allFlags.length > 0 ? allFlags.join(',') : null;
  await pool.execute(
    `INSERT INTO punch_events (employeeId, punchAt, workDate, type, source, ip, userAgent, deviceId, flags)
     VALUES (?, ?, ?, ?, 'web', ?, ?, ?, ?)`,
    [employee.employeeId, now.dateTime, workDate, type, cleanIp || null, String(userAgent || '').slice(0, 255) || null, device.deviceId, flags]
  );
  const day = await recomputeDay(pool, employee.employeeId, workDate);
  return { type, punchAt: now.dateTime, workDate, flags: allFlags, day };
}

// ---- HR：查詢、作廢、補登、裝置、批次設定 ---------------------------------------------------

export async function listPunchEvents(pool, { from, to, q, status, limit = 100, offset = 0 }) {
  const where = [];
  const params = [];
  if (from) { where.push('e.workDate >= ?'); params.push(from); }
  if (to) { where.push('e.workDate <= ?'); params.push(to); }
  if (status === 'valid' || status === 'voided') { where.push('e.status = ?'); params.push(status); }
  if (q) { where.push('(e.employeeId LIKE ? OR emp.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM punch_events e LEFT JOIN employees emp ON emp.employeeId = e.employeeId ${clause}`, params
  );
  const [rows] = await pool.query(
    `SELECT e.*, emp.name AS employeeName, d.label AS deviceLabel
     FROM punch_events e
     LEFT JOIN employees emp ON emp.employeeId = e.employeeId
     LEFT JOIN punch_devices d ON d.id = e.deviceId
     ${clause} ORDER BY e.punchAt DESC, e.id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );
  return { total, rows };
}

export async function voidPunchEvent(pool, id, actor, reason) {
  if (!String(reason || '').trim()) throw new PunchError(400, 'REASON_REQUIRED', '請填寫作廢原因');
  const [rows] = await pool.execute('SELECT * FROM punch_events WHERE id = ?', [id]);
  const event = rows[0];
  if (!event) throw new PunchError(404, 'NOT_FOUND', '找不到該筆打卡紀錄');
  if (event.status === 'voided') throw new PunchError(409, 'ALREADY_VOIDED', '這筆紀錄已經作廢');
  await pool.execute(
    `UPDATE punch_events SET status = 'voided', voidedBy = ?, voidedAt = ?, voidReason = ? WHERE id = ?`,
    [actor, taipeiNow().dateTime, String(reason).trim().slice(0, 255), id]
  );
  await recomputeDay(pool, event.employeeId, event.workDate);
  return event;
}

// HR 補登：員工忘記打卡等情況，須填原因；只能補登使用系統打卡的員工，並留下補登者
export async function addCorrection(pool, actor, { employeeId, date, time, type, reason }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new PunchError(400, 'BAD_DATE', '日期格式必須是 YYYY-MM-DD');
  if (!/^\d{2}:\d{2}$/.test(String(time || ''))) throw new PunchError(400, 'BAD_TIME', '時間格式必須是 HH:MM');
  if (!['in', 'out'].includes(type)) throw new PunchError(400, 'BAD_TYPE', '打卡類型不正確');
  if (!String(reason || '').trim()) throw new PunchError(400, 'REASON_REQUIRED', '請填寫補登原因');
  const employee = await getEmployee(pool, employeeId);
  if (!employee) throw new PunchError(404, 'NO_EMPLOYEE', '找不到該員工');
  if (employee.attendanceSource !== 'system') throw new PunchError(409, 'NOT_SYSTEM', '這位員工的出勤來源是外部匯入，請用匯入更正，不能在這裡補登');
  if (`${date} ${time}:00` > taipeiNow().dateTime) throw new PunchError(400, 'FUTURE', '不能補登未來的時間');
  // 跨夜班的下班補登，時間在隔天時仍歸入上班那天：這裡以使用者指定的日期為準（工作日）
  const [result] = await pool.execute(
    `INSERT INTO punch_events (employeeId, punchAt, workDate, type, source, note, createdBy) VALUES (?, ?, ?, ?, 'correction', ?, ?)`,
    [employeeId, `${date} ${time}:00`, date, type, String(reason).trim().slice(0, 255), actor]
  );
  const day = await recomputeDay(pool, employeeId, date);
  return { id: result.insertId, day };
}

export async function listDevices(pool) {
  const [rows] = await pool.execute(
    `SELECT d.id, d.employeeId, emp.name AS employeeName, d.label, d.status, d.firstSeenAt, d.lastSeenAt, d.lastIp, d.approvedBy, d.approvedAt
     FROM punch_devices d LEFT JOIN employees emp ON emp.employeeId = d.employeeId
     ORDER BY FIELD(d.status, 'pending', 'approved', 'revoked'), d.lastSeenAt DESC`
  );
  return rows;
}

export async function setDeviceStatus(pool, id, status, actor) {
  const [rows] = await pool.execute('SELECT id FROM punch_devices WHERE id = ?', [id]);
  if (!rows[0]) throw new PunchError(404, 'NOT_FOUND', '找不到該裝置');
  if (status === 'approved') {
    await pool.execute(`UPDATE punch_devices SET status = 'approved', approvedBy = ?, approvedAt = ? WHERE id = ?`, [actor, taipeiNow().dateTime, id]);
  } else {
    await pool.execute(`UPDATE punch_devices SET status = 'revoked' WHERE id = ?`, [id]);
  }
}

// 今日出勤：使用系統打卡的在職員工，今天的上下班時間與是否遲到
export async function todayOverview(pool) {
  const now = taipeiNow();
  const settings = await getAttendanceSettings(pool);
  const [rows] = await pool.execute(
    `SELECT emp.employeeId, emp.name, emp.department, a.clockIn, a.clockOut, a.status, a.note
     FROM employees emp LEFT JOIN attendance_records a ON a.employeeId = emp.employeeId AND a.date = ?
     WHERE emp.active = TRUE AND emp.attendanceSource = 'system' ORDER BY emp.employeeId`,
    [now.date]
  );
  const grace = 10;
  const [h, m] = settings.defaultShiftStart.split(':').map(Number);
  const limit = h * 60 + m + grace;
  return {
    date: now.date, serverTime: now.dateTime, shiftStart: settings.defaultShiftStart,
    rows: rows.map((r) => {
      const t = r.clockIn ? String(r.clockIn).slice(0, 5).split(':').map(Number) : null;
      return { ...r, clockIn: r.clockIn ? String(r.clockIn).slice(0, 5) : null, clockOut: r.clockOut ? String(r.clockOut).slice(0, 5) : null,
        late: t ? t[0] * 60 + t[1] > limit : false };
    }),
  };
}

// 批次設定員工的出勤來源（可依部門或指定員工）。切換為 system 前請先確認該員工已有登入帳號與員工編號
export async function setAttendanceSource(pool, { source, department, employeeIds }) {
  if (!['import', 'system'].includes(source)) throw new Error('出勤來源不正確');
  if (department) {
    const [result] = await pool.execute('UPDATE employees SET attendanceSource = ? WHERE department = ? AND active = TRUE', [source, department]);
    return result.affectedRows;
  }
  if (Array.isArray(employeeIds) && employeeIds.length > 0) {
    const [result] = await pool.query('UPDATE employees SET attendanceSource = ? WHERE employeeId IN (?)', [source, employeeIds]);
    return result.affectedRows;
  }
  throw new Error('請指定部門或員工');
}
