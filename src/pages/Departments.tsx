
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import DepartmentFilters from "@/components/departments/DepartmentFilters";
import DepartmentCard from "@/components/departments/DepartmentCard";
import AddDepartmentDialog from "@/components/departments/AddDepartmentDialog";
import EditDepartmentDialog from "@/components/departments/EditDepartmentDialog";
import DepartmentViewDialog from "@/components/departments/DepartmentViewDialog";
import DepartmentConfirmDialog from "@/components/departments/DepartmentConfirmDialog";
import { useDepartments } from "@/hooks/useDepartments";

const Departments = () => {
  const {
    searchTerm,
    setSearchTerm,
    filteredDepartments,
    loading,
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
  } = useDepartments();
  
  const departmentHierarchy = getDepartmentHierarchy();
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">部門管理</h1>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hrms-primary mx-auto mb-4"></div>
            <p className="text-gray-600">載入部門資料中...</p>
          </div>
        </div>
      </div>
    );
  }
  
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
            {filteredDepartments.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">找不到符合條件的部門</p>
              </div>
            ) : (
              filteredDepartments.map((department) => (
                <DepartmentCard
                  key={department.id}
                  department={department}
                  onView={openViewDialog}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                />
              ))
            )}
          </div>
        ) : (
          // 常規顯示（層次結構）
          departmentHierarchy.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">尚無部門資料</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="bg-hrms-accent">
                <Plus className="mr-2 h-4 w-4" /> 新增第一個部門
              </Button>
            </div>
          ) : (
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
          )
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
