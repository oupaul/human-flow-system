// 打卡異常統計：讓上線跑一兩個月後，能用數字決定要不要加 QR 碼、定位等更強的防護。
// 資料來源：打卡事件（含旗標）、被擋下的打卡嘗試（punch_rejections，只從啟用後開始記錄）、缺卡異常、補卡與公出申請、裝置。
// 只提供統計，不自動下結論。

import { taipeiNow, getAttendanceSettings } from './punch.js';
import { listPunchExceptions } from './punchExceptions.js';

const IP_CODES = ['IP_BLOCKED'];
const DEVICE_CODES = ['DEVICE_OTHER', 'DEVICE_PENDING', 'DEVICE_REVOKED', 'DEVICE_LIMIT', 'DEVICE_MISSING'];
const SECURITY_CODES = [...IP_CODES, ...DEVICE_CODES];
const OPERATIONAL_CODES = ['ALREADY_IN', 'NOT_IN', 'TOO_FAST'];
const KNOWN_FLAGS = ['new_device', 'device_other_employee', 'device_pending', 'device_revoked', 'no_device_id', 'outing'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const mondayOf = (ymd) => { const d = new Date(`${ymd}T00:00:00Z`).getUTCDay(); return addDays(ymd, -((d + 6) % 7)); };

export async function getPunchStats(pool, { from, to }) {
  const today = taipeiNow().date;
  const end = DATE_RE.test(String(to || '')) ? to : today;
  const start = DATE_RE.test(String(from || '')) ? from : addDays(end, -27);
  if (start > end) throw new Error('起始日不能晚於結束日');
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > MAX_DAYS) throw new Error(`查詢區間最多 ${MAX_DAYS} 天`);
  const range = [start, end];

  const one = async (sql, params = range) => (await pool.execute(sql, params))[0];

  // 規模
  const [{ systemEmployees }] = await one(`SELECT COUNT(*) AS systemEmployees FROM employees WHERE active = TRUE AND attendanceSource = 'system'`, []);
  const [events] = await one(
    `SELECT SUM(source = 'web' AND status = 'valid') AS webPunches, SUM(source = 'correction' AND status = 'valid') AS hrCorrections,
            SUM(status = 'voided') AS voided, COUNT(DISTINCT CASE WHEN status = 'valid' THEN employeeId END) AS punchers
     FROM punch_events WHERE workDate BETWEEN ? AND ?`
  );
  const webPunches = Number(events.webPunches ?? 0);

  // 被擋下的打卡嘗試
  const rejectionRows = await one(
    `SELECT code, COUNT(*) AS count, COUNT(DISTINCT employeeId) AS employees FROM punch_rejections
     WHERE DATE(attemptedAt) BETWEEN ? AND ? GROUP BY code ORDER BY count DESC`
  );
  const [{ since }] = await one('SELECT MIN(attemptedAt) AS since FROM punch_rejections', []);
  const countOf = (codes) => rejectionRows.filter((r) => codes.includes(r.code)).reduce((t, r) => t + Number(r.count), 0);
  const ipBlocked = countOf(IP_CODES);
  const deviceBlocked = countOf(DEVICE_CODES);
  const securityRejections = ipBlocked + deviceBlocked;

  // 每週趨勢（週一起算）
  const weeks = new Map();
  const bucket = (w) => {
    if (!weeks.has(w)) weeks.set(w, { weekStart: w, webPunches: 0, ipBlocked: 0, deviceBlocked: 0, exceptions: 0, correctionRequests: 0, hrCorrections: 0 });
    return weeks.get(w);
  };
  for (let w = mondayOf(start); w <= end; w = addDays(w, 7)) bucket(w);
  const addRows = (rows, field) => rows.forEach((r) => { bucket(String(r.w).slice(0, 10))[field] += Number(r.n); });
  const weekExpr = (col) => `DATE_SUB(${col}, INTERVAL WEEKDAY(${col}) DAY)`;
  addRows(await one(`SELECT ${weekExpr('workDate')} AS w, COUNT(*) AS n FROM punch_events WHERE source = 'web' AND status = 'valid' AND workDate BETWEEN ? AND ? GROUP BY w`), 'webPunches');
  addRows(await one(`SELECT ${weekExpr('workDate')} AS w, COUNT(*) AS n FROM punch_events WHERE source = 'correction' AND status = 'valid' AND workDate BETWEEN ? AND ? GROUP BY w`), 'hrCorrections');
  addRows(await one(`SELECT ${weekExpr('workDate')} AS w, COUNT(*) AS n FROM punch_exceptions WHERE workDate BETWEEN ? AND ? GROUP BY w`), 'exceptions');
  addRows(await one(`SELECT ${weekExpr('DATE(created_at)')} AS w, COUNT(*) AS n FROM punch_correction_requests WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY w`), 'correctionRequests');
  addRows(await one(`SELECT ${weekExpr('DATE(attemptedAt)')} AS w, COUNT(*) AS n FROM punch_rejections WHERE code IN (?) AND DATE(attemptedAt) BETWEEN ? AND ? GROUP BY w`.replace('IN (?)', `IN (${IP_CODES.map(() => '?').join(',')})`), [...IP_CODES, ...range]), 'ipBlocked');
  addRows(await one(`SELECT ${weekExpr('DATE(attemptedAt)')} AS w, COUNT(*) AS n FROM punch_rejections WHERE code IN (${DEVICE_CODES.map(() => '?').join(',')}) AND DATE(attemptedAt) BETWEEN ? AND ? GROUP BY w`, [...DEVICE_CODES, ...range]), 'deviceBlocked');

  // 被 IP 擋下最多的來源與人
  const topIps = await one(
    `SELECT ip, COUNT(*) AS count, COUNT(DISTINCT employeeId) AS employees, MAX(attemptedAt) AS lastSeen FROM punch_rejections
     WHERE code = 'IP_BLOCKED' AND DATE(attemptedAt) BETWEEN ? AND ? GROUP BY ip ORDER BY count DESC LIMIT 10`
  );
  const topEmployees = await one(
    `SELECT r.employeeId, e.name, e.department, COUNT(*) AS total,
            SUM(r.code = 'IP_BLOCKED') AS ipBlocked, SUM(r.code IN (${DEVICE_CODES.map(() => '?').join(',')})) AS deviceBlocked
     FROM punch_rejections r LEFT JOIN employees e ON e.employeeId = r.employeeId
     WHERE r.code IN (${SECURITY_CODES.map(() => '?').join(',')}) AND DATE(r.attemptedAt) BETWEEN ? AND ?
     GROUP BY r.employeeId, e.name, e.department ORDER BY total DESC LIMIT 10`,
    [...DEVICE_CODES, ...SECURITY_CODES, ...range]
  );

  // 裝置
  const [{ newDevices }] = await one('SELECT COUNT(*) AS newDevices FROM punch_devices WHERE DATE(firstSeenAt) BETWEEN ? AND ?');
  const deviceStatus = await one('SELECT status, COUNT(*) AS count FROM punch_devices GROUP BY status', []);
  const [{ multiDevice }] = await one(
    `SELECT COUNT(*) AS multiDevice FROM (SELECT employeeId FROM punch_devices WHERE status = 'approved' GROUP BY employeeId HAVING COUNT(*) >= 2) t`, []
  );
  const [flagRow] = await one(
    `SELECT ${KNOWN_FLAGS.map((f) => `SUM(flags LIKE '%${f}%') AS ${f}`).join(', ')} FROM punch_events WHERE workDate BETWEEN ? AND ?`
  );
  const flags = Object.fromEntries(KNOWN_FLAGS.map((f) => [f, Number(flagRow[f] ?? 0)]));

  // 缺卡與申請
  const exceptions = await listPunchExceptions(pool, { status: 'all', from: start, to: end });
  const exceptionSummary = {
    total: exceptions.length,
    open: exceptions.filter((e) => !e.resolved).length,
    byKind: ['no_punch', 'missing_in', 'missing_out'].map((k) => ({ kind: k, count: exceptions.filter((e) => e.kind === k).length })),
  };
  const correctionByStatus = await one(`SELECT status, COUNT(*) AS count FROM punch_correction_requests WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY status`);
  const outingByStatus = await one(`SELECT status, COUNT(*) AS count FROM outing_applications WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY status`);

  // 遲到（系統打卡、有班別者；寬限 10 分鐘，沿用現有出勤分析的設定）
  const settings = await getAttendanceSettings(pool);
  const [lateRow] = await one(
    `SELECT COUNT(*) AS days, SUM(clockIn > ADDTIME(shiftStart, '00:10:00')) AS late FROM attendance_records
     WHERE source = 'system' AND clockIn IS NOT NULL AND shiftStart IS NOT NULL AND date BETWEEN ? AND ?`
  );

  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
  return {
    period: { from: start, to: end },
    rejectionsSince: since ? String(since) : null,
    defaultShift: `${settings.defaultShiftStart}~${settings.defaultShiftEnd}`,
    summary: {
      systemEmployees: Number(systemEmployees), punchers: Number(events.punchers ?? 0), webPunches,
      hrCorrections: Number(events.hrCorrections ?? 0), voided: Number(events.voided ?? 0),
      ipBlocked, deviceBlocked, securityRejections,
      // 被擋比例＝被擋下的嘗試 ÷（成功打卡＋被擋下的嘗試）
      ipBlockedRate: pct(ipBlocked, webPunches + securityRejections), deviceBlockedRate: pct(deviceBlocked, webPunches + securityRejections),
      operationalRejections: countOf(OPERATIONAL_CODES),
      lateDays: Number(lateRow.late ?? 0), workedDays: Number(lateRow.days ?? 0), lateRate: pct(Number(lateRow.late ?? 0), Number(lateRow.days ?? 0)),
    },
    rejectionsByCode: rejectionRows.map((r) => ({ code: r.code, count: Number(r.count), employees: Number(r.employees) })),
    weekly: [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    topIps: topIps.map((r) => ({ ip: r.ip, count: Number(r.count), employees: Number(r.employees), lastSeen: String(r.lastSeen) })),
    topEmployees: topEmployees.map((r) => ({ ...r, total: Number(r.total), ipBlocked: Number(r.ipBlocked), deviceBlocked: Number(r.deviceBlocked) })),
    devices: { newDevices: Number(newDevices), status: deviceStatus.map((d) => ({ status: d.status, count: Number(d.count) })), employeesWithMultipleDevices: Number(multiDevice), flags },
    exceptions: exceptionSummary,
    requests: {
      corrections: correctionByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      outings: outingByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    },
  };
}
