import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import DepartmentFilters from "@/components/departments/DepartmentFilters";
import DepartmentCard from "@/components/departments/DepartmentCard";
import AddDepartmentDialog from "@/components/departments/AddDepartmentDialog";
import EditDepartmentDialog from "@/components/departments/EditDepartmentDialog";
import DepartmentViewDialog from "@/components/departments/DepartmentViewDialog";
import DepartmentConfirmDialog from "@/components/departments/DepartmentConfirmDialog";
import { useDepartments } from "@/hooks/useDepartments";

const Departments = () => {
  const { t } = useTranslation(["departments", "common"]);
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
    departments,
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
  } = useDepartments();
  
  const departmentHierarchy = getDepartmentHierarchy();
  
  // 處理新增部門按鈕點擊
  const handleAddClick = () => {
    console.log('Add department button clicked');
    // 確保表單完全重置
    addForm.reset({
      name: "",
      leadName: "",
      parentId: undefined,
      description: "",
    });
    setIsAddDialogOpen(true);
  };
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.departments")}</h1>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hrms-primary mx-auto mb-4"></div>
            <p className="text-gray-600">{t("departments:page.loadingDepartments")}</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.departments")}</h1>
        <Button onClick={handleAddClick} className="bg-hrms-accent">
          <Plus className="mr-2 h-4 w-4" /> {t("departments:page.addDepartment")}
        </Button>
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
          <div className="grid gap-6 md:grid-cols-2">
            {filteredDepartments.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">{t("departments:page.noSearchResults")}</p>
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
              <p className="text-gray-500 mb-4">{t("departments:page.noDepartments")}</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="bg-hrms-accent">
                <Plus className="mr-2 h-4 w-4" /> {t("departments:page.addFirstDepartment")}
              </Button>
            </div>
          ) : (
            // 沒有子部門的部門直接放進同一個共用網格，讓沒有階層關係的部門
            // 彼此也能一列兩欄排列；有子部門的才需要獨立區塊（跨兩欄）顯示
            // 標題與主/子部門群組，避免階層關係被拆散
            <div className="grid gap-6 md:grid-cols-2">
              {departmentHierarchy.map((hierarchy) =>
                hierarchy.sub.length === 0 ? (
                  <DepartmentCard
                    key={hierarchy.main.id}
                    department={hierarchy.main}
                    onView={openViewDialog}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                  />
                ) : (
                  <div key={hierarchy.main.id} className="space-y-4 md:col-span-2">
                    <div className="flex items-center">
                      <h2 className="text-lg font-semibold">{hierarchy.main.name}</h2>
                      <span className="ml-2 rounded-full bg-hrms-primary px-2.5 py-0.5 text-xs text-white">
                        {t("departments:shared.employeeCount", { count: hierarchy.main.employeeCount })}
                      </span>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
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
                )
              )}
            </div>
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
      
      {/* 部門詳情對話框（含成員管理） */}
      <DepartmentViewDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        department={selectedDepartment}
        members={selectedDepartment ? getDepartmentMembers(selectedDepartment.name) : []}
        assignableEmployees={selectedDepartment ? getAssignableEmployees(selectedDepartment.name) : []}
        otherDepartments={departments}
        onMoveEmployee={moveEmployeeToDepartment}
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
