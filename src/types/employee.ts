
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

export const departmentOptions = [
  { value: "all", label: "所有部門" },
  { value: "IT部門", label: "IT部門" },
  { value: "人資部門", label: "人資部門" },
  { value: "財務部門", label: "財務部門" },
  { value: "行銷部門", label: "行銷部門" },
  { value: "業務部門", label: "業務部門" },
];

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

export const employeesData = [
  { id: 1, name: "張小明", employeeId: "EMP001", department: "IT部門", position: "軟體工程師", email: "ming@example.com", phone: "0912-345-678", joinDate: "2020-01-15", active: true, address: "", notes: "" },
  { id: 2, name: "李小華", employeeId: "EMP002", department: "人資部門", position: "人資專員", email: "hua@example.com", phone: "0923-456-789", joinDate: "2019-05-20", active: true, address: "", notes: "" },
  { id: 3, name: "王大明", employeeId: "EMP003", department: "財務部門", position: "會計師", email: "daming@example.com", phone: "0934-567-890", joinDate: "2021-03-10", active: true, address: "", notes: "" },
  { id: 4, name: "陳小玲", employeeId: "EMP004", department: "行銷部門", position: "行銷經理", email: "ling@example.com", phone: "0945-678-901", joinDate: "2018-11-05", active: false, terminationDate: "2023-06-30", terminationReason: "個人因素離職", address: "", notes: "" },
  { id: 5, name: "林小美", employeeId: "EMP005", department: "業務部門", position: "業務代表", email: "mei@example.com", phone: "0956-789-012", joinDate: "2022-02-15", active: true, address: "", notes: "" },
  { id: 6, name: "黃大力", employeeId: "EMP006", department: "IT部門", position: "系統管理員", email: "dali@example.com", phone: "0967-890-123", joinDate: "2020-08-20", active: true, address: "", notes: "" },
  { id: 7, name: "吳小菁", employeeId: "EMP007", department: "人資部門", position: "招聘專員", email: "jing@example.com", phone: "0978-901-234", joinDate: "2021-06-25", active: true, address: "", notes: "" },
  { id: 8, name: "趙小剛", employeeId: "EMP008", department: "財務部門", position: "財務分析師", email: "gang@example.com", phone: "0989-012-345", joinDate: "2019-09-30", active: false, terminationDate: "2024-01-15", terminationReason: "公司組織調整", address: "", notes: "" },
];

export const employeeToFormData = (employee: typeof employeesData[0]): EmployeeFormData => {
  return {
    ...employee,
    terminationDate: employee.terminationDate || "",
    terminationReason: employee.terminationReason || "",
    address: employee.address || "",
    notes: employee.notes || ""
  };
};
