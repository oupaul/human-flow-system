
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { 
  EmployeeFormData, 
  emptyFormData, 
  employeeToFormData,
  Employee
} from "@/types/employee";
import { useEmployees } from "@/hooks/useEmployees";
import { useEmployeeFilters } from "@/hooks/useEmployeeFilters";
import EmployeeFilters from "@/components/employees/EmployeeFilters";
import EmployeeTable from "@/components/employees/EmployeeTable";
import AddEmployeeDialog from "@/components/employees/AddEmployeeDialog";
import EditEmployeeDialog from "@/components/employees/EditEmployeeDialog";
import EmployeeDetailSheet from "@/components/employees/EmployeeDetailSheet";
import EmployeeConfirmDialogs from "@/components/employees/EmployeeConfirmDialogs";

const Employees = () => {
  const { employees, loading, addEmployee, updateEmployee, deleteEmployee, terminateEmployee } = useEmployees();
  const {
    searchTerm,
    setSearchTerm,
    selectedDepartment,
    setSelectedDepartment,
    selectedStatus,
    setSelectedStatus,
    filteredEmployees,
  } = useEmployeeFilters(employees);

  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isViewEmployeeOpen, setIsViewEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isTerminateConfirmOpen, setIsTerminateConfirmOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeFormData | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(emptyFormData);

  // 處理表單輸入變更
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log('Form field changed:', name, value);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 處理選擇變更
  const handleSelectChange = (name: string, value: string) => {
    console.log('Select field changed:', name, value);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 處理勾選框變更
  const handleSwitchChange = (name: string, checked: boolean) => {
    console.log('Switch field changed:', name, checked);
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // 查看員工詳細資料
  const handleViewEmployee = (employee: Employee) => {
    const employeeFormData = employeeToFormData(employee);
    setSelectedEmployee(employeeFormData);
    setIsViewEmployeeOpen(true);
  };

  // 編輯員工資料
  const handleEditEmployee = (employee: Employee | EmployeeFormData) => {
    const employeeFormData = 'terminationDate' in employee && typeof employee.terminationDate === 'string' 
      ? employee as EmployeeFormData 
      : employeeToFormData(employee as Employee);
    setSelectedEmployee(employeeFormData);
    setFormData(employeeFormData);
    setIsEditEmployeeOpen(true);
  };

  // 刪除員工
  const handleDeleteEmployee = (employee: Employee) => {
    const employeeFormData = employeeToFormData(employee);
    setSelectedEmployee(employeeFormData);
    setIsDeleteConfirmOpen(true);
  };

  // 確認刪除員工
  const confirmDeleteEmployee = () => {
    if (selectedEmployee) {
      deleteEmployee(selectedEmployee.id);
      setIsDeleteConfirmOpen(false);
    }
  };

  // 處理員工離職
  const handleTerminateEmployee = (employee: Employee) => {
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
    if (selectedEmployee && formData.terminationDate) {
      terminateEmployee(selectedEmployee.id, {
        terminationDate: formData.terminationDate,
        terminationReason: formData.terminationReason
      });
      setIsTerminateConfirmOpen(false);
    }
  };

  // 新增員工
  const handleAddEmployee = () => {
    console.log('Attempting to add employee with form data:', formData);
    addEmployee(formData);
    setIsAddEmployeeOpen(false);
    setFormData(emptyFormData);
  };

  // 更新員工資料
  const handleUpdateEmployee = () => {
    if (selectedEmployee) {
      console.log('Updating employee with form data:', formData);
      updateEmployee(formData);
      setIsEditEmployeeOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">員工管理</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hrms-accent mx-auto"></div>
            <p className="mt-2 text-muted-foreground">載入中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">員工管理</h1>
        <Button className="bg-hrms-accent" onClick={() => {
          setFormData(emptyFormData);
          setIsAddEmployeeOpen(true);
        }}>
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
