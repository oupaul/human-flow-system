
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["departments", "common"]);

  if (!department) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("departments:view.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{department.name}</h3>
            <p className="text-sm text-gray-500">
              {department.parentId ? t("departments:view.subDepartment") : t("departments:view.mainDepartment")}
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <h4 className="text-sm font-medium">{t("departments:view.leadLabel")}</h4>
              <p>{department.leadName}</p>
            </div>

            {department.parentId && department.parentName && (
              <div>
                <h4 className="text-sm font-medium">{t("departments:view.parentDepartmentLabel")}</h4>
                <p>{department.parentName}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium">{t("departments:view.employeeCountLabel")}</h4>
              <p>{t("departments:view.employeeCountValue", { count: department.employeeCount })}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium">{t("departments:view.descriptionLabel")}</h4>
              <p className="text-sm text-gray-600">{department.description}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("common:actions.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentViewDialog;
