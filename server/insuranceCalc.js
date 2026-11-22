// 勞保／健保／勞退的月試算（純函式，不碰資料庫，方便驗證）。
// 費率與負擔比例一律由 HR 在系統內匯入（insurance_rates），這裡不內建任何數字；
// 缺少任何必要項目時由呼叫端報錯，絕不用預設值代替——這是金額，寧可不算也不要算錯。
// 試算值僅供參考，實際金額以勞保局、健保署的繳款單為準。

export const RATE_KEYS = {
  laborRate: '勞保費率（普通事故＋就業保險合計，%）',
  laborEmployeeShare: '勞保 勞工負擔比例（%）',
  laborEmployerShare: '勞保 雇主負擔比例（%）',
  laborEmployerOnlyRate: '勞保 雇主全額負擔費率（職災保險、工資墊償基金等合計，%；沒有請填 0）',
  healthRate: '健保費率（%）',
  healthEmployeeShare: '健保 被保險人負擔比例（%）',
  healthEmployerShare: '健保 雇主負擔比例（%）',
  healthAvgDependents: '健保 平均眷屬人數（雇主負擔用，政府公告）',
  healthDependentCap: '健保 眷屬計費人數上限',
  pensionEmployerRate: '勞退 雇主提繳率（%）',
};

export const BRACKET_TYPES = ['labor', 'health', 'pension'];

const round = (n) => Math.round(n);

// 在級距清單（升冪）中找「大於等於月薪的最小級距」；月薪超過最高級距時取最高級距
export function suggestBracket(salary, amounts) {
  if (!amounts || amounts.length === 0 || !salary) return null;
  return amounts.find((a) => a >= salary) ?? amounts[amounts.length - 1];
}

// comp：該月適用的薪資紀錄（employee_compensation 一列，可為 null）
// rates：{ rateKey: number }；brackets：{ labor: number[], health: number[], pension: number[] }（可為空）
export function calculateItem(comp, rates, brackets = {}) {
  const warnings = [];
  const item = {
    monthlySalary: comp?.monthlySalary ?? null,
    laborInsured: comp?.laborInsuredSalary ?? null,
    healthInsured: comp?.healthInsuredSalary ?? null,
    pensionWage: comp?.pensionWage ?? null,
    voluntaryPensionRate: comp?.voluntaryPensionRate ?? null,
    healthDependents: comp?.healthDependents ?? null,
    laborEmployee: null, laborEmployer: null,
    healthEmployee: null, healthEmployer: null,
    pensionEmployer: null, pensionEmployee: null,
    warnings,
  };

  if (!comp) {
    warnings.push('找不到該月適用的薪資紀錄');
    return item;
  }

  // 勞保：員工與雇主各依負擔比例，雇主另加全額負擔的費率
  if (comp.laborInsuredSalary) {
    const base = comp.laborInsuredSalary * rates.laborRate / 100;
    item.laborEmployee = round(base * rates.laborEmployeeShare / 100);
    item.laborEmployer = round(base * rates.laborEmployerShare / 100)
      + round(comp.laborInsuredSalary * rates.laborEmployerOnlyRate / 100);
  } else warnings.push('未填勞保投保薪資，勞保未試算');

  // 健保：員工 = 本人＋眷屬（最多計上限人數）；雇主 = 乘上（1＋平均眷屬數）
  if (comp.healthInsuredSalary) {
    const base = comp.healthInsuredSalary * rates.healthRate / 100;
    const charged = Math.min(comp.healthDependents ?? 0, rates.healthDependentCap);
    item.healthEmployee = round(base * rates.healthEmployeeShare / 100 * (1 + charged));
    item.healthEmployer = round(base * rates.healthEmployerShare / 100 * (1 + rates.healthAvgDependents));
  } else warnings.push('未填健保投保薪資，健保未試算');

  // 勞退：雇主強制提繳；員工自願提繳依自提率
  if (comp.pensionWage) {
    item.pensionEmployer = round(comp.pensionWage * rates.pensionEmployerRate / 100);
    item.pensionEmployee = round(comp.pensionWage * (comp.voluntaryPensionRate ?? 0) / 100);
  } else warnings.push('未填勞退提繳工資，勞退未試算');

  // 與級距表核對：不在級距內、或低於「大於等於月薪的最小級距」時提示（不影響試算）
  const checks = [
    ['勞保投保薪資', comp.laborInsuredSalary, brackets.labor],
    ['健保投保薪資', comp.healthInsuredSalary, brackets.health],
    ['勞退提繳工資', comp.pensionWage, brackets.pension],
  ];
  for (const [label, value, amounts] of checks) {
    if (!value || !amounts || amounts.length === 0) continue;
    if (!amounts.includes(value)) warnings.push(`${label} ${value} 不在級距表內`);
    const suggested = suggestBracket(comp.monthlySalary, amounts);
    if (suggested && value < suggested) warnings.push(`${label} ${value} 低於月薪 ${comp.monthlySalary} 對應的級距 ${suggested}`);
  }
  return item;
}

export function sumItems(items) {
  const sum = (key) => items.reduce((total, i) => total + (i[key] ?? 0), 0);
  const employee = sum('laborEmployee') + sum('healthEmployee') + sum('pensionEmployee');
  const employer = sum('laborEmployer') + sum('healthEmployer') + sum('pensionEmployer');
  return { salary: sum('monthlySalary'), employee, employer, totalCost: sum('monthlySalary') + employer };
}
