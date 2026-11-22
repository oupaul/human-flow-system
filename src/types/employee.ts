export type Gender = "male" | "female";
export type ScheduleMode = "fixed" | "rotating";

export interface Employee {
  id: number;
  name: string;
  employeeId: string;
  department: string;
  position: string;
  email: string;
  phone: string;
  joinDate: string;
  active: boolean;
  terminationDate?: string;
  terminationReason?: string;
  address: string;
  notes: string;
  monthlySalary?: number | null;
  gender?: Gender | null;
  scheduleMode?: ScheduleMode | null;
  attendanceSource?: "import" | "system";
  punchIpExempt?: boolean;
  attendanceAccount?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeFormData {
  id: number;
  name: string;
  employeeId: string;
  department: string;
  position: string;
  email: string;
  phone: string;
  joinDate: string;
  active: boolean;
  terminationDate: string;
  terminationReason: string;
  address: string;
  notes: string;
  monthlySalary: number | null;
  gender: Gender | "";
  // 出勤制度：空字串＝使用公司預設；排班制的休息日、例假日、國定假日都平移，日別依個人排班判斷
  scheduleMode: ScheduleMode | "";
  // 出勤來源：import＝考勤由外部系統匯入；system＝使用系統打卡（匯入時略過）；punchIpExempt＝不受打卡 IP 限制（外勤）
  attendanceSource: "import" | "system";
  punchIpExempt: boolean;
  attendanceAccount: string;
  // 僅新增員工時使用：系統上線時導入既有員工，登記他們在此之前已休掉的特休天數
  initialAnnualLeaveUsed?: number | null;
  // 僅新增員工時使用：上一期遞延進來的特休天數（需在本期休完，否則週年結算時折現）
  initialCarriedInDays?: number | null;
}

export const statusOptions = [
  { value: "all", label: "全部" },
  { value: "active", label: "在職" },
  { value: "inactive", label: "離職" },
];

export const emptyFormData: EmployeeFormData = {
  id: 0,
  name: "",
  employeeId: "",
  department: "",
  position: "",
  email: "",
  phone: "",
  joinDate: "",
  active: true,
  terminationDate: "",
  terminationReason: "",
  address: "",
  notes: "",
  monthlySalary: null,
  gender: "",
  scheduleMode: "",
  attendanceSource: "import",
  punchIpExempt: false,
  attendanceAccount: "",
  initialAnnualLeaveUsed: null,
  initialCarriedInDays: null,
};

export const employeeToFormData = (employee: Employee): EmployeeFormData => {
  return {
    id: employee.id,
    name: employee.name,
    employeeId: employee.employeeId,
    department: employee.department,
    position: employee.position,
    email: employee.email,
    phone: employee.phone,
    joinDate: employee.joinDate,
    active: employee.active,
    terminationDate: employee.terminationDate || "",
    terminationReason: employee.terminationReason || "",
    address: employee.address || "",
    notes: employee.notes || "",
    monthlySalary: employee.monthlySalary ?? null,
    gender: employee.gender || "",
    scheduleMode: employee.scheduleMode || "",
    attendanceSource: employee.attendanceSource || "import",
    punchIpExempt: !!employee.punchIpExempt,
    attendanceAccount: employee.attendanceAccount || "",
  };
};
