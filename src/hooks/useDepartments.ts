import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Department, DepartmentFormData, departmentFormSchema, ParentDepartmentOption } from "@/types/department";
import { Employee } from "@/types/employee";
import { departmentApi } from "@/services/departmentApi";
import { employeeApi } from "@/services/employeeApi";

export const useDepartments = () => {
  const { t } = useTranslation(["departments", "common"]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  const addForm: UseFormReturn<DepartmentFormData> = useForm({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      leadName: "",
      parentId: undefined,
      description: "",
    },
    mode: "onChange",
  }) as UseFormReturn<DepartmentFormData>;

  const editForm: UseFormReturn<DepartmentFormData> = useForm({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      leadName: "",
      parentId: undefined,
      description: "",
    },
    mode: "onChange",
  }) as UseFormReturn<DepartmentFormData>;

  // 初始載入部門與員工資料（員工資料用於「部門成員」管理）
  useEffect(() => {
    loadDepartments();
    loadEmployees();
  }, []);

  // selectedDepartment 是開啟對話框當下的快照；在成員管理對話框裡加入/移出
  // 成員後，部門列表會重新載入，這裡讓快照跟著更新，員工數量等統計才不會顯示過期資料
  useEffect(() => {
    if (selectedDepartment) {
      const fresh = departments.find((dept) => dept.id === selectedDepartment.id);
      if (fresh && fresh !== selectedDepartment) {
        setSelectedDepartment(fresh);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments]);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await departmentApi.getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Failed to load departments:', error);
      toast.error(t("common:common.loadFailed"), {
        description: t("common:common.networkErrorHint"),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  // 取得主管部門清單（不包括自己）
  const getParentDepartmentOptions = (currentId?: number): ParentDepartmentOption[] => {
    return departments
      .filter((dept) => !dept.parentId && (!currentId || dept.id !== currentId))
      .map((dept) => ({
        id: dept.id,
        name: dept.name,
      }));
  };

  // 根據搜尋條件過濾部門
  const filteredDepartments = departments.filter((department) =>
    department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    department.leadName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 某部門目前的在職成員（比對邏輯與後端 employeeCount 一致）
  const getDepartmentMembers = (departmentName: string): Employee[] =>
    employees.filter((employee) => employee.department === departmentName && employee.active);

  // 可加入某部門的員工（在職、且目前不在該部門）
  const getAssignableEmployees = (departmentName: string): Employee[] =>
    employees.filter((employee) => employee.department !== departmentName && employee.active);

  // 將員工改派到另一個部門；供「部門成員」的加入/移動操作使用
  const moveEmployeeToDepartment = async (employee: Employee, departmentName: string) => {
    try {
      await employeeApi.updateEmployeeDepartment(employee.id, departmentName);
      await Promise.all([loadDepartments(), loadEmployees()]);
      toast.success(t("departments:members.moveSuccess", { employee: employee.name, department: departmentName }));
    } catch (error) {
      console.error('Failed to move employee to department:', error);
      toast.error(t("departments:members.moveFailed"), {
        description: error instanceof Error ? error.message : t("common:common.networkErrorHint"),
      });
    }
  };

  // 處理部門新增
  const handleAddDepartment = async (data: DepartmentFormData) => {
    try {
      if (!data.name || !data.leadName) {
        toast.error(t("departments:toasts.addFailedTitle"), {
          description: t("departments:toasts.addMissingFields"),
        });
        return;
      }
      await departmentApi.createDepartment(data);
      await loadDepartments();
      setIsAddDialogOpen(false);
      addForm.reset({
        name: "",
        leadName: "",
        parentId: undefined,
        description: "",
      });
      toast.success(t("departments:toasts.addSuccessTitle"), {
        description: t("departments:toasts.addSuccessDescription", { name: data.name }),
      });
    } catch (error) {
      console.error('Failed to create department:', error);
      toast.error(t("departments:toasts.addFailedTitle"), {
        description: error instanceof Error ? error.message : t("common:common.networkErrorHint"),
      });
    }
  };

  // 處理部門編輯
  const handleEditDepartment = async (data: DepartmentFormData) => {
    if (!selectedDepartment) return;

    try {
      await departmentApi.updateDepartment(selectedDepartment.id, data);
      await Promise.all([loadDepartments(), loadEmployees()]);
      setIsEditDialogOpen(false);
      setSelectedDepartment(null);

      toast.success(t("departments:toasts.editSuccessTitle"), {
        description: t("departments:toasts.editSuccessDescription", { name: data.name }),
      });
    } catch (error) {
      console.error('Failed to update department:', error);
      toast.error(t("departments:toasts.editFailedTitle"), {
        description: t("common:common.networkErrorHint"),
      });
    }
  };

  // 處理部門刪除
  const handleDeleteDepartment = async () => {
    if (!selectedDepartment) return;

    // 檢查是否有子部門
    const hasSubDepartments = departments.some(
      dept => dept.parentId === selectedDepartment.id
    );

    if (hasSubDepartments) {
      toast.error(t("departments:toasts.deleteBlockedTitle"), {
        description: t("departments:toasts.deleteBlockedHasSubDepartments"),
      });
      setIsDeleteDialogOpen(false);
      return;
    }

    // 檢查是否有員工
    if (selectedDepartment.employeeCount > 0) {
      toast.error(t("departments:toasts.deleteBlockedTitle"), {
        description: t("departments:toasts.deleteBlockedHasEmployees"),
      });
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      await departmentApi.deleteDepartment(selectedDepartment.id);
      await loadDepartments();
      setIsDeleteDialogOpen(false);
      const deletedName = selectedDepartment.name;
      setSelectedDepartment(null);

      toast.success(t("departments:toasts.deleteSuccessTitle"), {
        description: t("departments:toasts.deleteSuccessDescription", { name: deletedName }),
      });
    } catch (error) {
      console.error('Failed to delete department:', error);
      toast.error(t("departments:toasts.deleteFailedTitle"), {
        description: t("common:common.networkErrorHint"),
      });
    }
  };

  // 開啟編輯對話框
  const openEditDialog = (department: Department) => {
    setSelectedDepartment(department);
    editForm.reset();
    editForm.reset({
      id: department.id,
      name: department.name,
      leadName: department.leadName,
      parentId: department.parentId || undefined,
      description: department.description || "",
    });
    setIsEditDialogOpen(true);
  };

  // 開啟查看對話框
  const openViewDialog = (department: Department) => {
    setSelectedDepartment(department);
    setIsViewDialogOpen(true);
  };

  // 開啟刪除對話框
  const openDeleteDialog = (department: Department) => {
    setSelectedDepartment(department);
    setIsDeleteDialogOpen(true);
  };

  // 根據 parentId 分組部門
  const getDepartmentHierarchy = () => {
    const mainDepartments = departments.filter(dept => !dept.parentId);

    return mainDepartments.map(mainDept => {
      const subDepartments = departments.filter(
        dept => dept.parentId === mainDept.id
      );
      return {
        main: mainDept,
        sub: subDepartments,
      };
    });
  };

  return {
    departments,
    loading,
    searchTerm,
    setSearchTerm,
    filteredDepartments,
    isAddDialogOpen,
    setIsAddDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isViewDialogOpen,
    setIsViewDialogOpen,
    selectedDepartment,
    addForm,
    editForm,
    getParentDepartmentOptions,
    getDepartmentMembers,
    getAssignableEmployees,
    moveEmployeeToDepartment,
    handleAddDepartment,
    handleEditDepartment,
    handleDeleteDepartment,
    openEditDialog,
    openViewDialog,
    openDeleteDialog,
    getDepartmentHierarchy,
    loadDepartments,
  };
};
