
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Employee, EmployeeFormData, employeeToFormData } from "@/types/employee";
import { employeeApi } from "@/services/employeeApi";

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始載入員工資料
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      console.log('Loading employees...');
      const data = await employeeApi.getEmployees();
      console.log('Employees loaded:', data);
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
      toast.error("載入員工資料失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  const addEmployee = async (employeeData: EmployeeFormData) => {
    try {
      console.log('Adding employee with data:', employeeData);
      
      // 檢查必填欄位
      if (!employeeData.name || !employeeData.employeeId || !employeeData.department || 
          !employeeData.position || !employeeData.email || !employeeData.joinDate) {
        toast.error("新增失敗", {
          description: "請填寫所有必填欄位（姓名、員工編號、部門、職位、電子郵件、到職日期）",
        });
        return;
      }

      const result = await employeeApi.createEmployee(employeeData);
      console.log('Employee created successfully:', result);
      await loadEmployees(); // 重新載入資料
      toast.success("新增成功", {
        description: `員工 ${employeeData.name} (${employeeData.employeeId}) 已新增。`,
      });
    } catch (error) {
      console.error('Failed to create employee:', error);
      toast.error("員工新增失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const updateEmployee = async (employeeData: EmployeeFormData) => {
    try {
      await employeeApi.updateEmployee(employeeData.id, employeeData);
      await loadEmployees(); // 重新載入資料
      toast.success("更新成功", {
        description: `員工 ${employeeData.name} (${employeeData.employeeId}) 的資料已更新。`,
      });
    } catch (error) {
      console.error('Failed to update employee:', error);
      toast.error("員工更新失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const deleteEmployee = async (employeeId: number) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    try {
      await employeeApi.deleteEmployee(employeeId);
      await loadEmployees(); // 重新載入資料
      toast.success("刪除成功", {
        description: `員工 ${employee.name} (${employee.employeeId}) 已被刪除。`,
      });
    } catch (error) {
      console.error('Failed to delete employee:', error);
      toast.error("員工刪除失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const terminateEmployee = async (employeeId: number, terminationData: { terminationDate: string; terminationReason: string }) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    try {
      await employeeApi.terminateEmployee(employeeId, terminationData);
      await loadEmployees(); // 重新載入資料
      toast.success("狀態更新成功", {
        description: `員工 ${employee.name} (${employee.employeeId}) 已標記為離職。`,
      });
    } catch (error) {
      console.error('Failed to terminate employee:', error);
      toast.error("員工狀態更新失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  return {
    employees,
    loading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    terminateEmployee,
    loadEmployees,
  };
};
