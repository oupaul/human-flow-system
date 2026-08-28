
import { useTranslation } from "react-i18next";
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
import { Department } from "@/types/department";

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
  const { t } = useTranslation(["departments", "common"]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("departments:confirmDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {department && (
              <>
                {t("departments:confirmDialog.description", { name: department.name })}<br />
                {t("departments:confirmDialog.note")}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-hrms-danger"
            onClick={onConfirm}
          >
            {t("departments:confirmDialog.confirmButton")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DepartmentConfirmDialog;
