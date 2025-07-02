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
    notes: employee.notes || ""
  };
};
