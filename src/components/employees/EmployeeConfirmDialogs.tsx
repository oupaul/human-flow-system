
import { Trans, useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["employees", "common"]);

  return (
    <>
      {/* 刪除員工確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("employees:confirmDialogs.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmployee && (
                <p>
                  <Trans
                    i18nKey="employees:confirmDialogs.delete.message"
                    values={{ name: selectedEmployee.name, employeeId: selectedEmployee.employeeId }}
                    components={{ 1: <strong /> }}
                  />
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={onConfirmDelete}
            >
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 標記員工離職確認對話框 */}
      <AlertDialog open={terminateDialogOpen} onOpenChange={onTerminateDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("employees:confirmDialogs.terminate.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmployee && (
                <p>
                  <Trans
                    i18nKey="employees:confirmDialogs.terminate.message"
                    values={{ name: selectedEmployee.name, employeeId: selectedEmployee.employeeId }}
                    components={{ 1: <strong /> }}
                  />
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmTerminate}>
              {t("common:actions.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EmployeeConfirmDialogs;
