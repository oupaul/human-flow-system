
import { useTranslation } from "react-i18next";
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
import { useState } from "react";
import { Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canViewSalary } from "@/services/authApi";
import CompensationDialog from "@/components/employees/CompensationDialog";

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
  const { t } = useTranslation(["employees", "common"]);
  const { user } = useAuth();
  const [compensationFor, setCompensationFor] = useState<string | null>(null);
  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>{t("employees:detail.title")}</SheetTitle>
          <SheetDescription>
            {t("employees:detail.description")}
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
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.name")}</h4>
                <p>{employee.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.employeeId")}</h4>
                <p>{employee.employeeId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.department")}</h4>
                <p>{employee.department}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.position")}</h4>
                <p>{employee.position}</p>
              </div>
            </div>

            {employee.gender && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("common:gender.label")}</h4>
                <p>{t(`common:gender.${employee.gender}`)}</p>
              </div>
            )}

            {employee.attendanceAccount && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.attendanceAccount")}</h4>
                <p>{employee.attendanceAccount}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.email")}</h4>
              <p>{employee.email}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.phone")}</h4>
              <p>{employee.phone}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.joinDate")}</h4>
              <p>{employee.joinDate}</p>
            </div>

            {!employee.active && employee.terminationDate && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.terminationDate")}</h4>
                <p>{employee.terminationDate}</p>
              </div>
            )}

            {!employee.active && employee.terminationReason && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.terminationReason")}</h4>
                <p>{employee.terminationReason}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.status")}</h4>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                employee.active
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {employee.active ? t("employees:status.active") : t("employees:status.inactive")}
              </span>
            </div>

            {employee.address && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.address")}</h4>
                <p>{employee.address}</p>
              </div>
            )}

            {canViewSalary(user?.role) && (
              <div>
                <Button variant="outline" onClick={() => setCompensationFor(employee.employeeId)}>
                  <Wallet className="mr-2 h-4 w-4" /> {t("employees:compensation.manageButton")}
                </Button>
              </div>
            )}

            {employee.notes && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t("employees:detail.fields.notes")}</h4>
                <p>{employee.notes}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common:actions.close")}
            </Button>
            <Button onClick={() => {
              onOpenChange(false);
              onEdit(employee);
            }}>
              {t("common:actions.edit")}
            </Button>
          </div>
        </div>
      </SheetContent>
      <CompensationDialog
        employeeId={compensationFor}
        employeeName={employee.name}
        onClose={() => setCompensationFor(null)}
      />
    </Sheet>
  );
};

export default EmployeeDetailSheet;
