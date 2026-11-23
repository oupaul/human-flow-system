// 班表的 Excel 匯出／匯入（矩陣格式）：一列一位員工、一欄一天，格子填班別簡稱或「休／例／國」。
//   * 匯出的檔案同時是匯入範本：含目前已排的班表，改完可直接再匯入
//   * 空白格＝不變更；填「清除」＝刪除那一格的班表
//   * 匯入只做解析與檢查，回傳要寫入的儲存格；實際寫入由前端確認後呼叫 PUT /schedule/cells
import * as XLSX from 'xlsx';
import { getMonthSchedule, listShiftTypes, ScheduleError, OFF_LABELS } from './schedule.js';

const OFF_CODE = { rest_day: '休', regular_off: '例', national_holiday: '國' };
const OFF_ALIASES = {
  rest_day: ['休', '休息', '休息日'],
  regular_off: ['例', '例假', '例假日'],
  national_holiday: ['國', '國定', '國定假日', '國定假日（平移）'],
};
const CLEAR_ALIASES = ['清除', '清', '-', '－', '—'];
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_ROWS = 1000;
const MAX_ERRORS = 100;

const norm = (v) => String(v ?? '').trim();
const key = (v) => norm(v).toLowerCase();
const pad = (n) => String(n).padStart(2, '0');

function monthDates(month) {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, i) => `${month}-${pad(i + 1)}`);
}

export async function buildScheduleWorkbook(pool, month, department) {
  const data = await getMonthSchedule(pool, month, department || undefined);
  const dates = monthDates(month);
  const cellMap = new Map(data.rows.map((r) => [`${r.employeeId}|${r.date}`, r]));
  const label = (c) => (!c ? '' : c.kind === 'off' ? OFF_CODE[c.offType] : c.shiftLabel || '');

  const header = ['員工編號', '姓名', ...dates];
  const weekdays = ['', '', ...dates.map((d) => `週${WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()]}`)];
  const body = data.employees.map((e) => [e.employeeId, e.name, ...dates.map((d) => label(cellMap.get(`${e.employeeId}|${d}`)))]);
  const sheet = XLSX.utils.aoa_to_sheet([header, weekdays, ...body]);
  sheet['!cols'] = [{ wch: 12 }, { wch: 12 }, ...dates.map(() => ({ wch: 5 }))];
  sheet['!freeze'] = { xSplit: 2, ySplit: 2 };

  const help = [
    ['班表匯入說明'],
    ['一列一位員工、一欄一天。格子填下表的代號；空白＝不變更；填「清除」＝刪除那一格的班表。'],
    ['日期欄位的標題請保留 YYYY-MM-DD 格式（也接受 M/D 或只寫幾號，會以匯入時選擇的月份為準）。第二列的星期只是提示，匯入時會忽略。'],
    ['匯入後都是草稿，不會自動發布；套用前會先預覽並顯示排班警示。'],
    [],
    ['代號', '意思', '上下班時間', '休息（分鐘）'],
    ...data.shiftTypes.filter((t) => t.active).map((t) => [t.label, t.name, `${t.startTime}~${t.endTime}`, t.breakMinutes]),
    ...Object.entries(OFF_CODE).map(([type, code]) => [code, OFF_LABELS[type], '', '']),
    ['清除', '刪除那一格的班表', '', ''],
  ];
  const helpSheet = XLSX.utils.aoa_to_sheet(help);
  helpSheet['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '班表');
  XLSX.utils.book_append_sheet(workbook, helpSheet, '說明');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// 標題儲存格 → YYYY-MM-DD；認不出來回傳 null
function parseHeaderDate(text, month) {
  const t = norm(text).replace(/[（(].*$/, '').trim();
  if (!t) return null;
  const [my, mm] = month.split('-').map(Number);
  let y; let m; let d;
  let r;
  if ((r = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [y, m, d] = [r[1], r[2], r[3]].map(Number);
  else if ((r = t.match(/^(\d{1,2})[-/](\d{1,2})$/))) [y, m, d] = [my, Number(r[1]), Number(r[2])];
  else if ((r = t.match(/^(\d{1,2})$/))) [y, m, d] = [my, mm, Number(r[1])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export async function parseScheduleWorkbook(pool, buffer, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new ScheduleError(400, '月份格式不正確（需 YYYY-MM）');
  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer' }); } catch { throw new ScheduleError(400, '無法讀取這個檔案，請上傳 Excel（.xlsx）檔'); }
  const sheet = workbook.Sheets['班表'] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new ScheduleError(400, '檔案裡沒有工作表');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });

  const headerIndex = rows.findIndex((r) => ['員工編號', 'employeeid', '員工編碼'].includes(key(r[0])));
  if (headerIndex < 0) throw new ScheduleError(400, '找不到標題列：第一欄的標題必須是「員工編號」（建議直接用下載的範本）');

  const errors = [];
  let errorTotal = 0;
  const addError = (row, message) => { errorTotal += 1; if (errors.length < MAX_ERRORS) errors.push({ row, message }); };

  const columns = []; // { index, date }
  rows[headerIndex].forEach((cell, index) => {
    if (index < 2 || !norm(cell)) return;
    const date = parseHeaderDate(cell, month);
    if (date) columns.push({ index, date });
    else addError(headerIndex + 1, `第 ${index + 1} 欄的標題「${norm(cell)}」無法辨識為日期，這一欄已略過`);
  });
  if (columns.length === 0) throw new ScheduleError(400, '標題列裡找不到任何日期欄位');
  if (new Set(columns.map((c) => c.date)).size !== columns.length) throw new ScheduleError(400, '標題列有重複的日期');

  const dataRows = rows.slice(headerIndex + 1).map((r, i) => ({ r, line: headerIndex + 2 + i })).filter(({ r }) => norm(r[0]));
  if (dataRows.length > MAX_ROWS) throw new ScheduleError(400, `一次最多匯入 ${MAX_ROWS} 位員工`);

  const ids = [...new Set(dataRows.map(({ r }) => norm(r[0])))];
  const [empRows] = ids.length ? await pool.query('SELECT employeeId FROM employees WHERE employeeId IN (?)', [ids]) : [[]];
  const known = new Set(empRows.map((e) => e.employeeId));

  // 代號對照：名稱完全相同優先，其次簡稱；簡稱重複時要求先在班別管理改成不同簡稱
  const shiftTypes = await listShiftTypes(pool);
  const byName = new Map(shiftTypes.map((t) => [key(t.name), t]));
  const byLabel = new Map();
  for (const t of shiftTypes) {
    const k = key(t.label);
    byLabel.set(k, [...(byLabel.get(k) ?? []), t]);
  }
  const offByCode = new Map(Object.entries(OFF_ALIASES).flatMap(([type, codes]) => codes.map((c) => [key(c), type])));

  const resolve = (text) => {
    const k = key(text);
    if (CLEAR_ALIASES.map(key).includes(k)) return { clear: true };
    if (offByCode.has(k)) return { kind: 'off', offType: offByCode.get(k) };
    const t = byName.get(k) ?? (byLabel.get(k)?.length === 1 ? byLabel.get(k)[0] : null);
    if (t) return t.active ? { kind: 'shift', shiftTypeId: t.id } : { error: `班別「${t.name}」已停用` };
    if (byLabel.get(k)?.length > 1) return { error: `代號「${norm(text)}」對應到多個班別，請先到「班別管理」為它們設定不同的簡稱` };
    return { error: `不認得的代號「${norm(text)}」` };
  };

  const cells = [];
  const seen = new Set();
  const employeesInFile = new Set();
  for (const { r, line } of dataRows) {
    const employeeId = norm(r[0]);
    if (!known.has(employeeId)) { addError(line, `找不到員工編號「${employeeId}」，這一列已略過`); continue; }
    if (seen.has(employeeId)) { addError(line, `員工編號「${employeeId}」重複出現，這一列已略過`); continue; }
    seen.add(employeeId);
    employeesInFile.add(employeeId);
    for (const { index, date } of columns) {
      const text = norm(r[index]);
      if (!text) continue;
      const result = resolve(text);
      if (result.error) { addError(line, `${employeeId} ${date}：${result.error}`); continue; }
      cells.push(result.clear ? { employeeId, date, clear: true } : { employeeId, date, ...result });
    }
  }

  return {
    cells,
    errors,
    errorTotal,
    employees: employeesInFile.size,
    from: columns.map((c) => c.date).sort()[0],
    to: columns.map((c) => c.date).sort().slice(-1)[0],
  };
}
