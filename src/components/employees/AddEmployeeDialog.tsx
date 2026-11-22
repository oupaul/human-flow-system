import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeFormData } from "@/types/employee";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { canViewSalary } from "@/services/authApi";
import { departmentApi } from "@/services/departmentApi";

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: EmployeeFormData;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (name: string, value: string) => void;
  onSave: () => void;
}

const AddEmployeeDialog = ({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSelectChange,
  onSave
}: AddEmployeeDialogProps) => {
  const { t } = useTranslation(["employees", "common"]);
  const { user } = useAuth();
  const canSeeSalary = canViewSalary(user?.role);
  const [departments, setDepartments] = useState([]);
  useEffect(() => {
    if (open) {
      departmentApi.getDepartments().then(setDepartments).catch(() => setDepartments([]));
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{t("employees:addDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("employees:addDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("employees:form.name")}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t("employees:form.namePlaceholder")}
                value={formData.name}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeId">{t("employees:form.employeeId")}</Label>
              <Input
                id="employeeId"
                name="employeeId"
                placeholder={t("employees:form.employeeIdPlaceholder")}
                value={formData.employeeId}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">{t("employees:form.department")}</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => onSelectChange("department", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("employees:form.departmentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {departments.length === 0 ? (
                    <SelectItem value="__no_departments__" disabled>{t("employees:form.noDepartments")}</SelectItem>
                  ) : (
                    departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">{t("employees:form.position")}</Label>
              <Input
                id="position"
                name="position"
                placeholder={t("employees:form.positionPlaceholder")}
                value={formData.position}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">{t("employees:form.gender")}</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => onSelectChange("gender", value)}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder={t("employees:form.genderPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{t("common:gender.female")}</SelectItem>
                  <SelectItem value="male">{t("common:gender.male")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendanceAccount">{t("employees:form.attendanceAccount")}</Label>
              <Input
                id="attendanceAccount"
                name="attendanceAccount"
                placeholder={t("employees:form.attendanceAccountPlaceholder")}
                value={formData.attendanceAccount}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("employees:form.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("employees:form.emailPlaceholder")}
                value={formData.email}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("employees:form.phone")}</Label>
              <Input
                id="phone"
                name="phone"
                placeholder={t("employees:form.phonePlaceholder")}
                value={formData.phone}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="joinDate">{t("employees:form.joinDate")}</Label>
              <Input
                id="joinDate"
                name="joinDate"
                type="date"
                value={formData.joinDate}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t("employees:form.address")}</Label>
              <Input
                id="address"
                name="address"
                placeholder={t("employees:form.addressPlaceholder")}
                value={formData.address}
                onChange={onFormChange}
              />
            </div>
          </div>
          {canSeeSalary && (
            <div className="space-y-2">
              <Label htmlFor="monthlySalary">{t("employees:form.monthlySalary")}</Label>
              <Input
                id="monthlySalary"
                name="monthlySalary"
                type="number"
                min="0"
                placeholder={t("employees:form.monthlySalaryPlaceholder")}
                value={formData.monthlySalary ?? ""}
                onChange={onFormChange}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="initialAnnualLeaveUsed">{t("employees:form.initialAnnualLeaveUsed")}</Label>
            <Input
              id="initialAnnualLeaveUsed"
              name="initialAnnualLeaveUsed"
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              value={formData.initialAnnualLeaveUsed ?? ""}
              onChange={onFormChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initialCarriedInDays">{t("employees:form.initialCarriedInDays")}</Label>
            <Input
              id="initialCarriedInDays"
              name="initialCarriedInDays"
              type="number"
              min="0"
              max="30"
              step="0.5"
              placeholder="0"
              value={formData.initialCarriedInDays ?? ""}
              onChange={onFormChange}
            />
            <p className="text-xs text-muted-foreground">{t("employees:form.initialCarriedInDaysHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t("employees:form.notes")}</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder={t("employees:form.notesPlaceholder")}
              value={formData.notes}
              onChange={onFormChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={onSave}>
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeDialog;
