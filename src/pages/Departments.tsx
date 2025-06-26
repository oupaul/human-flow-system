import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import DepartmentFilters from "@/components/departments/DepartmentFilters";
import DepartmentCard from "@/components/departments/DepartmentCard";
import AddDepartmentDialog from "@/components/departments/AddDepartmentDialog";
import EditDepartmentDialog from "@/components/departments/EditDepartmentDialog";
import DepartmentViewDialog from "@/components/departments/DepartmentViewDialog";
import DepartmentConfirmDialog from "@/components/departments/DepartmentConfirmDialog";

// 部門表單驗證結構
const departmentFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, { message: "部門名稱不能為空" }),
  leadName: z.string().min(1, { message: "部門主管不能為空" }),
  parentId: z.number().optional(),
  description: z.string().optional(),
});

type DepartmentFormData = z.infer<typeof departmentFormSchema>;

// 部門資料結構
interface Department {
  id: number;
  name: string;
  leadName: string;
  parentId?: number;
  employeeCount: number;
  description: string;
  parentName?: string;
}

// 模擬資料
const initialDepartmentsData: Department[] = [
  {
    id: 1,
    name: "IT部門",
    leadName: "陳志明",
    employeeCount: 15,
    description: "負責公司所有IT系統的開發和維護，包括內部系統和客戶產品。",
  },
  {
    id: 2,
    name: "人資部門",
    leadName: "王美玲",
    employeeCount: 8,
    description: "負責員工招聘、培訓、績效評估以及所有人力資源相關事務。",
  },
  {
    id: 3,
    name: "財務部門",
    leadName: "林大偉",
    employeeCount: 10,
    description: "負責公司財務規劃、會計、稅務申報和財務報告。",
  },
  {
    id: 4,
    name: "行銷部門",
    leadName: "李小芬",
    employeeCount: 12,
    description: "負責品牌建設、市場策略、產品推廣和社交媒體管理。",
  },
  {
    id: 5,
    name: "業務部門",
    leadName: "張俊傑",
    employeeCount: 18,
    description: "負責客戶開發、關係維護、銷售和商務談判。",
  },
  {
    id: 6,
    name: "研發團隊",
    leadName: "黃建國",
    parentId: 1,
    employeeCount: 8,
    description: "專注於新產品和技術的研發工作。",
  },
  {
    id: 7,
    name: "系統維護團隊",
    leadName: "劉小華",
    parentId: 1,
    employeeCount: 7,
    description: "負責系統維護和技術支持。",
  },
];

const Departments = () => {
  const [departments, setDepartments] = useState<Department[]>(initialDepartmentsData);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  
  const addForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      leadName: "",
      parentId: undefined,
      description: "",
    },
  });
  
  const editForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      leadName: "",
      parentId: undefined,
      description: "",
    },
  });

  // 取得主管部門清單（不包括自己）
  const getParentDepartmentOptions = (currentId?: number) => {
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
  const handleAddDepartment = (data: DepartmentFormData) => {
    const newDepartment: Department = {
      id: Math.max(0, ...departments.map(d => d.id)) + 1,
      name: data.name,
      leadName: data.leadName,
      parentId: data.parentId,
      employeeCount: 0,
      description: data.description || "",
    };
    
    if (data.parentId) {
      const parentDept = departments.find(d => d.id === data.parentId);
      if (parentDept) {
        newDepartment.parentName = parentDept.name;
      }
    }
    
    setDepartments([...departments, newDepartment]);
    setIsAddDialogOpen(false);
    addForm.reset();
    
    toast.success("部門新增成功", {
      description: `已成功新增「${data.name}」部門`,
    });
  };
  
  // 處理部門編輯
  const handleEditDepartment = (data: DepartmentFormData) => {
    if (!selectedDepartment) return;
    
    const updatedDepartments = departments.map((dept) => {
      if (dept.id === selectedDepartment.id) {
        const parentDept = data.parentId ? 
          departments.find(d => d.id === data.parentId) : undefined;
          
        return {
          ...dept,
          name: data.name,
          leadName: data.leadName,
          parentId: data.parentId,
          description: data.description || "",
          parentName: parentDept ? parentDept.name : undefined,
        };
      }
      return dept;
    });
    
    setDepartments(updatedDepartments);
    setIsEditDialogOpen(false);
    setSelectedDepartment(null);
    
    toast.success("部門更新成功", {
      description: `已成功更新「${data.name}」部門的資料`,
    });
  };
  
  // 處理部門刪除
  const handleDeleteDepartment = () => {
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
    
    const updatedDepartments = departments.filter(
      (dept) => dept.id !== selectedDepartment.id
    );
    
    setDepartments(updatedDepartments);
    setIsDeleteDialogOpen(false);
    setSelectedDepartment(null);
    
    toast.success("部門刪除成功", {
      description: `已成功刪除「${selectedDepartment.name}」部門`,
    });
  };
  
  // 開啟編輯對話框
  const openEditDialog = (department: Department) => {
    setSelectedDepartment(department);
    editForm.reset({
      id: department.id,
      name: department.name,
      leadName: department.leadName,
      parentId: department.parentId,
      description: department.description,
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
  
  const departmentHierarchy = getDepartmentHierarchy();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">部門管理</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-hrms-accent">
              <Plus className="mr-2 h-4 w-4" /> 新增部門
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>
      
      {/* 搜尋欄位 */}
      <DepartmentFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      
      {/* 部門列表 */}
      <div className="space-y-8">
        {searchTerm ? (
          // 搜尋結果顯示平鋪列表
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDepartments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onView={openViewDialog}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
              />
            ))}
          </div>
        ) : (
          // 常規顯示（層次結構）
          departmentHierarchy.map((hierarchy) => (
            <div key={hierarchy.main.id} className="space-y-4">
              <div className="flex items-center">
                <h2 className="text-lg font-semibold">{hierarchy.main.name}</h2>
                <span className="ml-2 rounded-full bg-hrms-primary px-2.5 py-0.5 text-xs text-white">
                  {hierarchy.main.employeeCount} 位員工
                </span>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <DepartmentCard
                  department={hierarchy.main}
                  onView={openViewDialog}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                />
                
                {hierarchy.sub.map((subDept) => (
                  <DepartmentCard
                    key={subDept.id}
                    department={subDept}
                    isSubDepartment={true}
                    onView={openViewDialog}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* 新增部門對話框 */}
      <AddDepartmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        form={addForm}
        parentOptions={getParentDepartmentOptions()}
        onSubmit={handleAddDepartment}
      />
      
      {/* 部門詳情對話框 */}
      <DepartmentViewDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        department={selectedDepartment}
      />
      
      {/* 編輯部門對話框 */}
      <EditDepartmentDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        form={editForm}
        parentOptions={getParentDepartmentOptions(selectedDepartment?.id)}
        onSubmit={handleEditDepartment}
      />
      
      {/* 刪除確認對話框 */}
      <DepartmentConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        department={selectedDepartment}
        onConfirm={handleDeleteDepartment}
      />
    </div>
  );
};

export default Departments;
