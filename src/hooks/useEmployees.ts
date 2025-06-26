
import { useState } from "react";
import { toast } from "sonner";
import { EmployeeFormData, employeesData, employeeToFormData } from "@/types/employee";

export const useEmployees = () => {
  const [employees, setEmployees] = useState(employeesData);

  const addEmployee = (employeeData: EmployeeFormData) => {
    const newEmployee = {
      id: Math.max(0, ...employees.map(e => e.id)) + 1,
      name: employeeData.name,
      employeeId: employeeData.employeeId,
      department: employeeData.department,
      position: employeeData.position,
      email: employeeData.email,
      phone: employeeData.phone,
      joinDate: employeeData.joinDate,
      active: employeeData.active,
      terminationDate: employeeData.terminationDate,
      terminationReason: employeeData.terminationReason,
      address: employeeData.address,
      notes: employeeData.notes,
    };

    setEmployees(prev => [...prev, newEmployee]);
    toast.success("新增成功", {
      description: `員工 ${employeeData.name} (${employeeData.employeeId}) 已新增。`,
    });
  };

  const updateEmployee = (employeeData: EmployeeFormData) => {
    setEmployees(prev => 
      prev.map(emp => 
        emp.id === employeeData.id 
          ? { ...emp, ...employeeData }
          : emp
      )
    );
    toast.success("更新成功", {
      description: `員工 ${employeeData.name} (${employeeData.employeeId}) 的資料已更新。`,
    });
  };

  const deleteEmployee = (employeeId: number) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
    toast.success("刪除成功", {
      description: `員工 ${employee.name} (${employee.employeeId}) 已被刪除。`,
    });
  };

  const terminateEmployee = (employeeId: number, terminationData: { terminationDate: string; terminationReason: string }) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    setEmployees(prev => 
      prev.map(emp => 
        emp.id === employeeId 
          ? { 
              ...emp, 
              active: false,
              terminationDate: terminationData.terminationDate,
              terminationReason: terminationData.terminationReason
            }
          : emp
      )
    );
    toast.success("狀態更新成功", {
      description: `員工 ${employee.name} (${employee.employeeId}) 已標記為離職。`,
    });
  };

  return {
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    terminateEmployee,
  };
};
