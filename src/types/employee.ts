export type Gender = "male" | "female";

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
  attendanceAccount: string;
  // 僅新增員工時使用：系統上線時導入既有員工，登記他們在此之前已休掉的特休天數
  initialAnnualLeaveUsed?: number | null;
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
  attendanceAccount: "",
  initialAnnualLeaveUsed: null,
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
    attendanceAccount: employee.attendanceAccount || "",
  };
};
