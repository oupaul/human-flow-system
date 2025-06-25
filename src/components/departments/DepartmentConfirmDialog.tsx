
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Department {
  id: number;
  name: string;
  leadName: string;
  parentId?: number;
  employeeCount: number;
  description: string;
  parentName?: string;
}

interface DepartmentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onConfirm: () => void;
}

const DepartmentConfirmDialog = ({
  open,
  onOpenChange,
  department,
  onConfirm,
}: DepartmentConfirmDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認刪除部門</AlertDialogTitle>
          <AlertDialogDescription>
            {department && (
              <>
                您確定要刪除「{department.name}」部門嗎？<br />
                只有無員工和無子部門的部門才能被刪除。此操作無法撤銷。
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction 
            className="bg-hrms-danger" 
            onClick={onConfirm}
          >
            確認刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DepartmentConfirmDialog;
