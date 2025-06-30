
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Department, DepartmentFormData, departmentFormSchema, ParentDepartmentOption } from "@/types/department";
import { departmentApi } from "@/services/departmentApi";

export const useDepartments = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
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

  // 初始載入部門資料
  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await departmentApi.getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Failed to load departments:', error);
      toast.error("載入部門資料失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
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
  
  // 處理部門新增
  const handleAddDepartment = async (data: DepartmentFormData) => {
    try {
      await departmentApi.createDepartment(data);
      await loadDepartments(); // 重新載入資料
      setIsAddDialogOpen(false);
      addForm.reset();
      
      toast.success("部門新增成功", {
        description: `已成功新增「${data.name}」部門`,
      });
    } catch (error) {
      console.error('Failed to create department:', error);
      toast.error("部門新增失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };
  
  // 處理部門編輯
  const handleEditDepartment = async (data: DepartmentFormData) => {
    if (!selectedDepartment) return;
    
    try {
      await departmentApi.updateDepartment(selectedDepartment.id, data);
      await loadDepartments(); // 重新載入資料
      setIsEditDialogOpen(false);
      setSelectedDepartment(null);
      
      toast.success("部門更新成功", {
        description: `已成功更新「${data.name}」部門的資料`,
      });
    } catch (error) {
      console.error('Failed to update department:', error);
      toast.error("部門更新失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
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
      toast.error("無法刪除部門", {
        description: "此部門有子部門存在，請先刪除或移動所有子部門。",
      });
      setIsDeleteDialogOpen(false);
      return;
    }
    
    // 檢查是否有員工
    if (selectedDepartment.employeeCount > 0) {
      toast.error("無法刪除部門", {
        description: "此部門還有員工存在，請先將員工移動到其他部門。",
      });
      setIsDeleteDialogOpen(false);
      return;
    }
    
    try {
      await departmentApi.deleteDepartment(selectedDepartment.id);
      await loadDepartments(); // 重新載入資料
      setIsDeleteDialogOpen(false);
      setSelectedDepartment(null);
      
      toast.success("部門刪除成功", {
        description: `已成功刪除「${selectedDepartment.name}」部門`,
      });
    } catch (error) {
      console.error('Failed to delete department:', error);
      toast.error("部門刪除失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };
  
  // 開啟編輯對話框
  const openEditDialog = (department: Department) => {
    console.log("Opening edit dialog for department:", department);
    setSelectedDepartment(department);
    
    // 確保表單完全重置
    editForm.reset();
    
    // 設置表單值
    const formValues = {
      id: department.id,
      name: department.name,
      leadName: department.leadName,
      parentId: department.parentId || undefined,
      description: department.description || "",
    };
    
    console.log("Setting form values:", formValues);
    editForm.reset(formValues);
    
    // 確保所有值都正確設置
    setTimeout(() => {
      console.log("Form values after reset:", editForm.getValues());
      setIsEditDialogOpen(true);
    }, 0);
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
