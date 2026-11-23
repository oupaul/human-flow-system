
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Employee, EmployeeFormData, employeeToFormData } from "@/types/employee";
import { employeeApi, ImportEmployeesResult } from "@/services/employeeApi";
import { ApiError } from "@/lib/apiClient";

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
      toast.success("新增成功，已自動建立登入帳號", {
        description: `員工 ${employeeData.name} (${employeeData.employeeId}) 已新增。登入帳號：${employeeData.email}，預設密碼：${employeeData.employeeId}，請提醒員工登入後自行修改密碼。`,
        duration: 15000,
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
        description: error instanceof ApiError ? error.message : "請檢查網路連線或聯繫系統管理員",
        duration: 12000,
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

  const resetPassword = async (employeeId: number) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    try {
      const result = await employeeApi.resetPassword(employeeId);
      toast.success("密碼已重設", {
        description: `員工 ${employee.name}（${result.username}）的登入密碼已重設為預設密碼：${result.defaultPassword}，請提醒員工登入後自行修改密碼。`,
        duration: 15000,
      });
    } catch (error) {
      console.error('Failed to reset employee password:', error);
      toast.error("重設密碼失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const importEmployees = async (csv: string): Promise<ImportEmployeesResult | null> => {
    try {
      const result = await employeeApi.importEmployees(csv);
      await loadEmployees();
      if (result.failed.length === 0) {
        toast.success("批次匯入完成", {
          description: `已成功新增 ${result.created} 位員工，皆已自動建立登入帳號（帳號＝email、預設密碼＝員工編號）。`,
          duration: 15000,
        });
      } else {
        toast.warning("批次匯入部分完成", {
          description: `成功 ${result.created} 筆，失敗 ${result.failed.length} 筆，詳見結果列表。`,
          duration: 15000,
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to import employees:', error);
      toast.error("批次匯入失敗", {
        description: error instanceof Error ? error.message : "請檢查網路連線或聯繫系統管理員",
      });
      return null;
    }
  };

  return {
    employees,
    loading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    terminateEmployee,
    resetPassword,
    importEmployees,
    loadEmployees,
  };
};
