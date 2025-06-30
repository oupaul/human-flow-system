
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Department } from "@/types/department";

interface DepartmentViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
}

const DepartmentViewDialog = ({
  open,
  onOpenChange,
  department,
}: DepartmentViewDialogProps) => {
  if (!department) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>部門詳情</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{department.name}</h3>
            <p className="text-sm text-gray-500">
              {department.parentId ? "子部門" : "主要部門"}
            </p>
          </div>
          
          <div className="grid gap-4">
            <div>
              <h4 className="text-sm font-medium">部門主管</h4>
              <p>{department.leadName}</p>
            </div>
            
            {department.parentId && department.parentName && (
              <div>
                <h4 className="text-sm font-medium">上級部門</h4>
                <p>{department.parentName}</p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium">員工數量</h4>
              <p>{department.employeeCount} 人</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium">部門描述</h4>
              <p className="text-sm text-gray-600">{department.description}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentViewDialog;
