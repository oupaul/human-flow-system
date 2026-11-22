// 缺卡偵測：每天找出「該上班卻沒有完整打卡」的員工，記錄並通知 HR（不通知員工本人）。
// 「該上班」的判斷：
//   * 有班表：排班（shift）的日子；排休（off）不算
//   * 沒有班表且是固定制：週一到週五且行事曆上不是放假日
//   * 沒有班表且是排班制：無法判斷，不偵測（避免誤報）
// 已核准的請假、公出涵蓋的日子不算缺卡。每天往回檢查最近 3 天，伺服器停機幾天也不會漏。

import { sendNotification } from './notifications.js';
import { taipeiNow, getAttendanceSettings } from './punch.js';
import { getScheduleMap } from './schedule.js';

const LOOKBACK_DAYS = 3;
const KIND_LABELS = { no_punch: '完全沒打卡', missing_in: '缺上班卡', missing_out: '缺下班卡' };

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const isoWeekday = (ymd) => { const d = new Date(`${ymd}T00:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; };

export async function detectPunchExceptions(pool) {
  const summary = { detected: 0 };
  try {
    const now = taipeiNow();
    const today = now.date;
    const from = addDays(today, -LOOKBACK_DAYS);
    // 昨天要等到早上 10 點之後才檢查，避免跨夜班（昨晚上班、今早才下班）被誤判成缺下班卡
    const to = Number(now.time.slice(0, 2)) < 10 ? addDays(today, -2) : addDays(today, -1);

    const [employees] = await pool.execute(
      `SELECT employeeId, name, department, joinDate, terminationDate, scheduleMode FROM employees WHERE active = TRUE AND attendanceSource = 'system'`
    );
    if (employees.length === 0) return summary;
    const settings = await getAttendanceSettings(pool);
    const ids = employees.map((e) => e.employeeId);

    const schedules = await getScheduleMap(pool, ids, from, to);
    const [holidayRows] = await pool.execute(`SELECT date FROM holidays WHERE isHoliday = TRUE AND date BETWEEN ? AND ?`, [from, to]);
    const holidays = new Set(holidayRows.map((h) => h.date));
    const [leaveRows] = await pool.query(
      `SELECT employeeId, startDate, endDate FROM leave_applications WHERE status = 'approved' AND employeeId IN (?) AND startDate <= ? AND endDate >= ?`, [ids, to, from]
    );
    const [outingRows] = await pool.query(
      `SELECT employeeId, startDate, endDate FROM outing_applications WHERE status = 'approved' AND employeeId IN (?) AND startDate <= ? AND endDate >= ?`, [ids, to, from]
    );
    const covered = (rows, id, date) => rows.some((r) => r.employeeId === id && r.startDate <= date && r.endDate >= date);
    const [events] = await pool.query(
      `SELECT employeeId, workDate, type FROM punch_events WHERE status = 'valid' AND employeeId IN (?) AND workDate BETWEEN ? AND ?`, [ids, from, to]
    );
    const punched = new Map(); // `${employeeId}|${date}` → { in, out }
    for (const e of events) {
      const key = `${e.employeeId}|${e.workDate}`;
      if (!punched.has(key)) punched.set(key, { in: false, out: false });
      punched.get(key)[e.type] = true;
    }

    const fresh = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      for (const e of employees) {
        if (e.joinDate > date || (e.terminationDate && e.terminationDate < date)) continue;
        const sched = schedules.get(e.employeeId)?.get(date);
        let expected;
        if (sched) expected = sched.kind === 'shift';
        else if ((e.scheduleMode ?? 'fixed') === 'rotating') continue; // 排班制沒排班：無法判斷
        else expected = isoWeekday(date) <= 5 && !holidays.has(date);
        if (!expected) continue;
        if (covered(leaveRows, e.employeeId, date) || covered(outingRows, e.employeeId, date)) continue;

        const p = punched.get(`${e.employeeId}|${date}`) ?? { in: false, out: false };
        const kind = !p.in && !p.out ? 'no_punch' : p.in && !p.out ? 'missing_out' : !p.in && p.out ? 'missing_in' : null;
        if (!kind) continue;
        const [result] = await pool.execute(
          'INSERT IGNORE INTO punch_exceptions (employeeId, workDate, kind, detectedAt) VALUES (?, ?, ?, ?)', [e.employeeId, date, kind, taipeiNow().dateTime]
        );
        if (result.affectedRows === 0) continue; // 已記錄過，不重複通知
        fresh.push({ e, date, kind });
        // 完全沒打卡的日子補一筆缺卡的每日出勤，讓出勤報表算得到
        if (kind === 'no_punch') {
          await pool.execute(
            `INSERT IGNORE INTO attendance_records (employeeId, date, shiftStart, shiftEnd, status, note, source) VALUES (?, ?, ?, ?, 'missing', '未打卡', 'system')`,
            [e.employeeId, date, sched?.startTime ? `${sched.startTime}:00` : `${settings.defaultShiftStart}:00`, sched?.endTime ? `${sched.endTime}:00` : `${settings.defaultShiftEnd}:00`]
          );
        }
      }
    }
    if (fresh.length > 0) {
      const lines = fresh.map((f) => `${f.date} ${f.e.name}（${f.e.employeeId}，${f.e.department}）：${KIND_LABELS[f.kind]}`);
      await sendNotification(pool, '缺卡提醒', `以下員工的打卡不完整，請確認是否需要補卡、請假或公出：\n${lines.join('\n')}`);
    }
    summary.detected = fresh.length;
  } catch (error) {
    console.error('缺卡偵測失敗（可能尚未套用 migration 020）：', error.message);
  }
  return summary;
}

// 異常清單：附上「現在」是否已處理。偵測當下的異常之後可能已經改變，所以用目前的資料重新判斷：
//   已處理 ＝ 現在已有完整打卡、被核准的請假／公出涵蓋、班表改成排休、或目前的缺卡類型和當初不同（以目前的類型為準）
export async function listPunchExceptions(pool, { status = 'open', from, to }) {
  const where = [];
  const params = [];
  if (from) { where.push('x.workDate >= ?'); params.push(from); }
  if (to) { where.push('x.workDate <= ?'); params.push(to); }
  const [rows] = await pool.execute(
    `SELECT x.id, x.employeeId, x.workDate, x.kind, x.detectedAt, e.name AS employeeName, e.department,
       EXISTS(SELECT 1 FROM punch_events p WHERE p.employeeId = x.employeeId AND p.workDate = x.workDate AND p.status = 'valid' AND p.type = 'in') AS hasIn,
       EXISTS(SELECT 1 FROM punch_events p WHERE p.employeeId = x.employeeId AND p.workDate = x.workDate AND p.status = 'valid' AND p.type = 'out') AS hasOut,
       EXISTS(SELECT 1 FROM leave_applications l WHERE l.employeeId = x.employeeId AND l.status = 'approved' AND l.startDate <= x.workDate AND l.endDate >= x.workDate) AS onLeave,
       EXISTS(SELECT 1 FROM outing_applications o WHERE o.employeeId = x.employeeId AND o.status = 'approved' AND o.startDate <= x.workDate AND o.endDate >= x.workDate) AS onOuting,
       EXISTS(SELECT 1 FROM work_schedules s WHERE s.employeeId = x.employeeId AND s.date = x.workDate AND s.kind = 'off') AS scheduledOff,
       EXISTS(SELECT 1 FROM punch_correction_requests r WHERE r.employeeId = x.employeeId AND r.workDate = x.workDate AND r.status = 'pending') AS hasPendingRequest
     FROM punch_exceptions x
     LEFT JOIN employees e ON e.employeeId = x.employeeId
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY x.workDate DESC, x.employeeId LIMIT 500`, params
  );
  const mapped = rows.map((r) => {
    const hasIn = !!r.hasIn;
    const hasOut = !!r.hasOut;
    const currentKind = !hasIn && !hasOut ? 'no_punch' : hasIn && !hasOut ? 'missing_out' : !hasIn && hasOut ? 'missing_in' : null;
    const resolved = currentKind === null || !!r.onLeave || !!r.onOuting || !!r.scheduledOff || currentKind !== r.kind;
    return {
      id: r.id, employeeId: r.employeeId, employeeName: r.employeeName, department: r.department, workDate: r.workDate, kind: r.kind,
      detectedAt: r.detectedAt, currentKind, resolved, hasPendingRequest: !!r.hasPendingRequest,
      resolvedBy: currentKind === null ? 'punched' : r.onLeave ? 'leave' : r.onOuting ? 'outing' : r.scheduledOff ? 'off' : currentKind !== r.kind ? 'changed' : null,
    };
  });
  return status === 'open' ? mapped.filter((r) => !r.resolved) : mapped;
}
