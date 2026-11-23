// 班表的 Excel 匯出／匯入（矩陣格式）：一列一位員工、一欄一天，格子填班別簡稱或「休／例／國」。
//   * 匯出的檔案同時是匯入範本：含目前已排的班表，改完可直接再匯入
//   * 空白格＝不變更；填「清除」＝刪除那一格的班表
//   * 匯入只做解析與檢查，回傳要寫入的儲存格；實際寫入由前端確認後呼叫 PUT /schedule/cells
import * as XLSX from 'xlsx';
import { getMonthSchedule, listShiftTypes, ScheduleError, OFF_LABELS } from './schedule.js';

const OFF_CODE = { rest_day: '休', regular_off: '例', national_holiday: '國' };
const OFF_ALIASES = {
  // 調休＝休息日平移到平日；國補＝國定假日平移到平日（系統內分別存成休息日、平移後的國定假日）
  rest_day: ['休', '休息', '休息日', '調休'],
  regular_off: ['例', '例假', '例假日'],
  national_holiday: ['國', '國定', '國定假日', '國定假日（平移）', '國補'],
};
const CLEAR_ALIASES = ['清除', '清', '-', '－', '—'];
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_ROWS = 1000;
const MAX_ERRORS = 100;

const norm = (v) => String(v ?? '').trim();
const key = (v) => norm(v).toLowerCase();
// 格子裡的代號可能被括號框起來，如值班表的「【D】」
const stripBrackets = (v) => norm(v).replace(/^[【\[［]\s*(.*?)\s*[】\]］]$/, '$1');
const nameKey = (v) => norm(v).replace(/\s+/g, ' ').toLowerCase();
const ID_HEADERS = ['員工編號', 'employeeid', '員工編碼'];
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

// 選工作表：名為「YYYY年M月」的分頁優先（值班表每月一個分頁），其次「班表」，最後第一個
function pickSheet(workbook, month) {
  const [y, m] = month.split('-').map(Number);
  const names = workbook.SheetNames;
  const name = names.find((n) => n.replace(/\s+/g, '') === `${y}年${m}月`) ?? (names.includes('班表') ? '班表' : names[0]);
  return { name, sheet: workbook.Sheets[name] };
}

// options.blankShiftTypeId：指定後，檔案內員工的空白格視為上班並填入該班別（值班表平日不填＝正常上班）
export async function parseScheduleWorkbook(pool, buffer, month, options = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new ScheduleError(400, '月份格式不正確（需 YYYY-MM）');
  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer' }); } catch { throw new ScheduleError(400, '無法讀取這個檔案，請上傳 Excel（.xlsx）檔'); }
  const { name: sheetName, sheet } = pickSheet(workbook, month);
  if (!sheet) throw new ScheduleError(400, '檔案裡沒有工作表');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });

  // 標準格式：第一欄標題「員工編號」；值班表格式：第一欄「編號」（流水號）＋第二欄姓名，以姓名對應員工
  let headerIndex = rows.findIndex((r) => ID_HEADERS.includes(key(r[0])));
  let byName = false;
  if (headerIndex < 0) {
    headerIndex = rows.findIndex((r) => key(r[0]) === '編號' && ['日期', '姓名'].includes(norm(r[1])));
    byName = headerIndex >= 0;
  }
  if (headerIndex < 0) throw new ScheduleError(400, '找不到標題列：第一欄的標題必須是「員工編號」（建議直接用下載的範本）');

  const errors = [];
  let errorTotal = 0;
  const addError = (row, message) => { errorTotal += 1; if (errors.length < MAX_ERRORS) errors.push({ row, message }); };

  const columns = []; // { index, date }
  const headerRow = rows[headerIndex];
  headerRow.forEach((cell, index) => {
    if (index < 2 || !norm(cell)) return;
    const date = parseHeaderDate(cell, month);
    if (date) columns.push({ index, date });
  });
  // 最後一個日期欄之後的欄位（如值班次數、津貼統計）直接忽略；夾在日期之間認不出來的才回報
  const lastDateIndex = columns.length ? columns[columns.length - 1].index : -1;
  headerRow.forEach((cell, index) => {
    if (index < 2 || index > lastDateIndex || !norm(cell) || columns.some((c) => c.index === index)) return;
    addError(headerIndex + 1, `第 ${index + 1} 欄的標題「${norm(cell)}」無法辨識為日期，這一欄已略過`);
  });
  if (columns.length === 0) throw new ScheduleError(400, '標題列裡找不到任何日期欄位');
  if (new Set(columns.map((c) => c.date)).size !== columns.length) throw new ScheduleError(400, '標題列有重複的日期');

  // 值班表：資料列是標題之後「編號為數字」的連續列，遇到空白編號（每日值班人數等統計區）就停
  const body = rows.slice(headerIndex + 1).map((r, i) => ({ r, line: headerIndex + 2 + i }));
  let dataRows;
  if (byName) {
    dataRows = [];
    for (const row of body) {
      if (/^\d+$/.test(norm(row.r[0]))) dataRows.push(row);
      else if (dataRows.length > 0) break;
    }
    dataRows = dataRows.filter(({ r }) => norm(r[1])); // 沒填姓名的空位直接略過
  } else {
    dataRows = body.filter(({ r }) => norm(r[0]));
  }
  if (dataRows.length > MAX_ROWS) throw new ScheduleError(400, `一次最多匯入 ${MAX_ROWS} 位員工`);

  // 員工對應：標準格式用員工編號；值班表格式用姓名（同名要先改成不同姓名）
  const [empAll] = await pool.query('SELECT employeeId, name FROM employees');
  const known = new Set(empAll.map((e) => e.employeeId));
  const idsByName = new Map();
  for (const e of empAll) idsByName.set(nameKey(e.name), [...(idsByName.get(nameKey(e.name)) ?? []), e.employeeId]);

  // 代號對照：名稱完全相同優先，其次簡稱；簡稱重複時要求先在班別管理改成不同簡稱
  const shiftTypes = await listShiftTypes(pool);
  const shiftByName = new Map(shiftTypes.map((t) => [key(t.name), t]));
  const byLabel = new Map();
  for (const t of shiftTypes) {
    const k = key(t.label);
    byLabel.set(k, [...(byLabel.get(k) ?? []), t]);
  }
  const offByCode = new Map(Object.entries(OFF_ALIASES).flatMap(([type, codes]) => codes.map((c) => [key(c), type])));

  const resolve = (text) => {
    const k = key(stripBrackets(text));
    if (CLEAR_ALIASES.map(key).includes(k)) return { clear: true };
    if (offByCode.has(k)) return { kind: 'off', offType: offByCode.get(k) };
    const t = shiftByName.get(k) ?? (byLabel.get(k)?.length === 1 ? byLabel.get(k)[0] : null);
    if (t) return t.active ? { kind: 'shift', shiftTypeId: t.id } : { error: `班別「${t.name}」已停用` };
    if (byLabel.get(k)?.length > 1) return { error: `代號「${norm(text)}」對應到多個班別，請先到「班別管理」為它們設定不同的簡稱` };
    return { error: `不認得的代號「${stripBrackets(text)}」（若是班別，請先到「班別管理」新增並設定簡稱為「${stripBrackets(text)}」）` };
  };

  let blankShift = null;
  if (options.blankShiftTypeId) {
    blankShift = shiftTypes.find((t) => t.id === Number(options.blankShiftTypeId));
    if (!blankShift || !blankShift.active) throw new ScheduleError(400, '「空白格視為上班」指定的班別不存在或已停用');
  }

  const cells = [];
  const seen = new Set();
  const employeesInFile = new Set();
  for (const { r, line } of dataRows) {
    let employeeId = norm(r[0]);
    if (byName) {
      const matches = idsByName.get(nameKey(r[1])) ?? [];
      if (matches.length === 0) { addError(line, `找不到姓名「${norm(r[1])}」的員工，這一列已略過`); continue; }
      if (matches.length > 1) { addError(line, `姓名「${norm(r[1])}」對應到多位員工，這一列已略過`); continue; }
      [employeeId] = matches;
    } else if (!known.has(employeeId)) { addError(line, `找不到員工編號「${employeeId}」，這一列已略過`); continue; }
    if (seen.has(employeeId)) { addError(line, `${byName ? `姓名「${norm(r[1])}」` : `員工編號「${employeeId}」`}重複出現，這一列已略過`); continue; }
    seen.add(employeeId);
    employeesInFile.add(employeeId);
    for (const { index, date } of columns) {
      const text = norm(r[index]);
      if (!text) {
        if (blankShift) cells.push({ employeeId, date, kind: 'shift', shiftTypeId: blankShift.id });
        continue;
      }
      const result = resolve(text);
      if (result.error) { addError(line, `${employeeId} ${date}：${result.error}`); continue; }
      cells.push(result.clear ? { employeeId, date, clear: true } : { employeeId, date, ...result });
    }
  }

  return {
    cells,
    sheetName,
    matchedBy: byName ? 'name' : 'employeeId',
    errors,
    errorTotal,
    employees: employeesInFile.size,
    from: columns.map((c) => c.date).sort()[0],
    to: columns.map((c) => c.date).sort().slice(-1)[0],
  };
}
