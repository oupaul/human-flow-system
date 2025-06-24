
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { EmployeeFormData } from "@/types/employee";

interface EmployeeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeFormData | null;
  onEdit: (employee: EmployeeFormData) => void;
}

const EmployeeDetailSheet = ({
  open,
  onOpenChange,
  employee,
  onEdit
}: EmployeeDetailSheetProps) => {
  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>員工詳細資料</SheetTitle>
          <SheetDescription>
            查看員工的完整資訊
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 py-6">
          <div className="flex items-center justify-center mb-6">
            <div className={`h-24 w-24 rounded-full flex items-center justify-center ${
              employee.active 
                ? "bg-hrms-accent" 
                : "bg-gray-400"
            }`}>
              <User className="h-12 w-12 text-white" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">姓名</h4>
                <p>{employee.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">員工編號</h4>
                <p>{employee.employeeId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">部門</h4>
                <p>{employee.department}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">職位</h4>
                <p>{employee.position}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">電子郵件</h4>
              <p>{employee.email}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">電話號碼</h4>
              <p>{employee.phone}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">到職日期</h4>
              <p>{employee.joinDate}</p>
            </div>

            {!employee.active && employee.terminationDate && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">離職日期</h4>
                <p>{employee.terminationDate}</p>
              </div>
            )}

            {!employee.active && employee.terminationReason && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">離職原因</h4>
                <p>{employee.terminationReason}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">在職狀態</h4>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                employee.active 
                  ? "bg-green-50 text-green-700" 
                  : "bg-red-50 text-red-700"
              }`}>
                {employee.active ? "在職中" : "已離職"}
              </span>
            </div>

            {employee.address && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">地址</h4>
                <p>{employee.address}</p>
              </div>
            )}

            {employee.notes && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">備註</h4>
                <p>{employee.notes}</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              關閉
            </Button>
            <Button onClick={() => {
              onOpenChange(false);
              onEdit(employee);
            }}>
              編輯
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EmployeeDetailSheet;
