
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
import { EmployeeFormData } from "@/types/employee";

interface EmployeeConfirmDialogsProps {
  deleteDialogOpen: boolean;
  terminateDialogOpen: boolean;
  selectedEmployee: EmployeeFormData | null;
  onDeleteDialogChange: (open: boolean) => void;
  onTerminateDialogChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  onConfirmTerminate: () => void;
}

const EmployeeConfirmDialogs = ({
  deleteDialogOpen,
  terminateDialogOpen,
  selectedEmployee,
  onDeleteDialogChange,
  onTerminateDialogChange,
  onConfirmDelete,
  onConfirmTerminate
}: EmployeeConfirmDialogsProps) => {
  return (
    <>
      {/* 刪除員工確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除員工</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmployee && (
                <p>
                  您確定要刪除員工 <strong>{selectedEmployee.name} ({selectedEmployee.employeeId})</strong> 嗎？此操作無法復原。
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={onConfirmDelete}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 標記員工離職確認對話框 */}
      <AlertDialog open={terminateDialogOpen} onOpenChange={onTerminateDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認標記員工為離職</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmployee && (
                <p>
                  您確定要將員工 <strong>{selectedEmployee.name} ({selectedEmployee.employeeId})</strong> 標記為已離職嗎？
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmTerminate}>
              確認
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EmployeeConfirmDialogs;
