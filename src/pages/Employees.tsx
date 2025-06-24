
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { 
  EmployeeFormData, 
  emptyFormData, 
  employeesData, 
  employeeToFormData 
} from "@/types/employee";
import EmployeeFilters from "@/components/employees/EmployeeFilters";
import EmployeeTable from "@/components/employees/EmployeeTable";
import AddEmployeeDialog from "@/components/employees/AddEmployeeDialog";
import EditEmployeeDialog from "@/components/employees/EditEmployeeDialog";
import EmployeeDetailSheet from "@/components/employees/EmployeeDetailSheet";
import EmployeeConfirmDialogs from "@/components/employees/EmployeeConfirmDialogs";

const Employees = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isViewEmployeeOpen, setIsViewEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isTerminateConfirmOpen, setIsTerminateConfirmOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeFormData | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(emptyFormData);
  const { toast } = useToast();
  
  // 篩選員工資料
  const filteredEmployees = employeesData.filter((employee) => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === "all" || 
      employee.department === selectedDepartment;
    
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && employee.active) ||
      (selectedStatus === "inactive" && !employee.active);
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  // 處理表單輸入變更
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 處理勾選框變更
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // 處理選擇變更
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 查看員工詳細資料
  const handleViewEmployee = (employee: typeof employeesData[0]) => {
    const employeeFormData = employeeToFormData(employee);
    setSelectedEmployee(employeeFormData);
    setIsViewEmployeeOpen(true);
  };

  // 編輯員工資料
  const handleEditEmployee = (employee: typeof employeesData[0] | EmployeeFormData) => {
    const employeeData = 'terminationDate' in employee ? employee : employeeToFormData(employee);
    setSelectedEmployee(employeeData);
    setFormData(employeeData);
    setIsEditEmployeeOpen(true);
  };

  // 刪除員工
  const handleDeleteEmployee = (employee: typeof employeesData[0]) => {
    const employeeFormData = employeeToFormData(employee);
    setSelectedEmployee(employeeFormData);
    setIsDeleteConfirmOpen(true);
  };

  // 確認刪除員工
  const confirmDeleteEmployee = () => {
    if (selectedEmployee) {
      toast({
        title: "刪除成功",
        description: `員工 ${selectedEmployee.name} (${selectedEmployee.employeeId}) 已被刪除。`,
      });
      setIsDeleteConfirmOpen(false);
    }
  };

  // 處理員工離職
  const handleTerminateEmployee = (employee: typeof employeesData[0]) => {
    const updatedEmployee = {
      ...employee,
      terminationDate: employee.terminationDate || new Date().toISOString().split('T')[0],
      terminationReason: employee.terminationReason || ""
    };
    const employeeFormData = employeeToFormData(updatedEmployee);
    setSelectedEmployee(employeeFormData);
    setFormData(employeeFormData);
    setIsTerminateConfirmOpen(true);
  };
  
  // 確認員工離職
  const confirmTerminateEmployee = () => {
    if (selectedEmployee) {
      toast({
        title: "狀態更新成功",
        description: `員工 ${selectedEmployee.name} (${selectedEmployee.employeeId}) 已標記為離職。`,
      });
      setIsTerminateConfirmOpen(false);
    }
  };

  // 新增員工
  const handleAddEmployee = () => {
    toast({
      title: "新增成功",
      description: `員工 ${formData.name} (${formData.employeeId}) 已新增。`,
    });
    setIsAddEmployeeOpen(false);
    setFormData(emptyFormData);
  };

  // 更新員工資料
  const handleUpdateEmployee = () => {
    if (selectedEmployee) {
      toast({
        title: "更新成功",
        description: `員工 ${formData.name} (${formData.employeeId}) 的資料已更新。`,
      });
      setIsEditEmployeeOpen(false);
    }
  };

  // 開啟新增員工對話框
  const openAddEmployeeDialog = () => {
    setFormData(emptyFormData);
    setIsAddEmployeeOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">員工管理</h1>
        <Button className="bg-hrms-accent" onClick={openAddEmployeeDialog}>
          <Plus className="mr-2 h-4 w-4" /> 新增員工
        </Button>
      </div>

      {/* 搜尋與篩選 */}
      <EmployeeFilters
        searchTerm={searchTerm}
        selectedDepartment={selectedDepartment}
        selectedStatus={selectedStatus}
        onSearchChange={setSearchTerm}
        onDepartmentChange={setSelectedDepartment}
        onStatusChange={setSelectedStatus}
      />

      {/* 員工表格 */}
      <EmployeeTable
        filteredEmployees={filteredEmployees}
        onViewEmployee={handleViewEmployee}
        onEditEmployee={handleEditEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onTerminateEmployee={handleTerminateEmployee}
      />

      {/* 新增員工對話框 */}
      <AddEmployeeDialog
        open={isAddEmployeeOpen}
        onOpenChange={setIsAddEmployeeOpen}
        formData={formData}
        onFormChange={handleFormChange}
        onSelectChange={handleSelectChange}
        onSave={handleAddEmployee}
      />

      {/* 查看員工詳細資料 */}
      <EmployeeDetailSheet
        open={isViewEmployeeOpen}
        onOpenChange={setIsViewEmployeeOpen}
        employee={selectedEmployee}
        onEdit={handleEditEmployee}
      />

      {/* 編輯員工資料 */}
      <EditEmployeeDialog
        open={isEditEmployeeOpen}
        onOpenChange={setIsEditEmployeeOpen}
        formData={formData}
        onFormChange={handleFormChange}
        onSelectChange={handleSelectChange}
        onSwitchChange={handleSwitchChange}
        onSave={handleUpdateEmployee}
      />

      {/* 確認對話框 */}
      <EmployeeConfirmDialogs
        deleteDialogOpen={isDeleteConfirmOpen}
        terminateDialogOpen={isTerminateConfirmOpen}
        selectedEmployee={selectedEmployee}
        onDeleteDialogChange={setIsDeleteConfirmOpen}
        onTerminateDialogChange={setIsTerminateConfirmOpen}
        onConfirmDelete={confirmDeleteEmployee}
        onConfirmTerminate={confirmTerminateEmployee}
      />
    </div>
  );
};

export default Employees;
