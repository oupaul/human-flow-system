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
import { Switch } from "@/components/ui/switch";
import WorkTimeFields from "@/components/employees/WorkTimeFields";
import { EmployeeFormData } from "@/types/employee";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { canViewSalary } from "@/services/authApi";
import { departmentApi } from "@/services/departmentApi";

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: EmployeeFormData;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (name: string, value: string) => void;
  onSwitchChange: (name: string, checked: boolean) => void;
  onSave: () => void;
}

const EditEmployeeDialog = ({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSelectChange,
  onSwitchChange,
  onSave
}: EditEmployeeDialogProps) => {
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
          <DialogTitle>{t("employees:editDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("employees:editDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editName">{t("employees:form.name")}</Label>
              <Input
                id="editName"
                name="name"
                placeholder={t("employees:form.namePlaceholder")}
                value={formData.name}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmployeeId">{t("employees:form.employeeId")}</Label>
              <Input
                id="editEmployeeId"
                name="employeeId"
                placeholder={t("employees:form.employeeIdPlaceholder")}
                value={formData.employeeId}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editDepartment">{t("employees:form.department")}</Label>
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
              <Label htmlFor="editPosition">{t("employees:form.position")}</Label>
              <Input
                id="editPosition"
                name="position"
                placeholder={t("employees:form.positionPlaceholder")}
                value={formData.position}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editGender">{t("employees:form.gender")}</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => onSelectChange("gender", value)}
              >
                <SelectTrigger id="editGender">
                  <SelectValue placeholder={t("employees:form.genderPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{t("common:gender.female")}</SelectItem>
                  <SelectItem value="male">{t("common:gender.male")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAttendanceAccount">{t("employees:form.attendanceAccount")}</Label>
              <Input
                id="editAttendanceAccount"
                name="attendanceAccount"
                placeholder={t("employees:form.attendanceAccountPlaceholder")}
                value={formData.attendanceAccount}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editEmail">{t("employees:form.email")}</Label>
              <Input
                id="editEmail"
                name="email"
                type="email"
                placeholder={t("employees:form.emailPlaceholder")}
                value={formData.email}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">{t("employees:form.phone")}</Label>
              <Input
                id="editPhone"
                name="phone"
                placeholder={t("employees:form.phonePlaceholder")}
                value={formData.phone}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editJoinDate">{t("employees:form.joinDate")}</Label>
              <Input
                id="editJoinDate"
                name="joinDate"
                type="date"
                value={formData.joinDate}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">{t("employees:form.address")}</Label>
              <Input
                id="editAddress"
                name="address"
                placeholder={t("employees:form.addressPlaceholder")}
                value={formData.address}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editScheduleMode">{t("employees:form.scheduleMode")}</Label>
            <Select
              value={formData.scheduleMode || "default"}
              onValueChange={(value) => onSelectChange("scheduleMode", value === "default" ? "" : value)}
            >
              <SelectTrigger id="editScheduleMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{t("employees:form.scheduleModeDefault")}</SelectItem>
                <SelectItem value="fixed">{t("employees:form.scheduleModeFixed")}</SelectItem>
                <SelectItem value="rotating">{t("employees:form.scheduleModeRotating")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("employees:form.scheduleModeHint")}</p>
          </div>
          {canSeeSalary && <WorkTimeFields idPrefix="edit" formData={formData} onFormChange={onFormChange} onSelectChange={onSelectChange} />}
          <div className="space-y-2">
            <Label htmlFor="editAttendanceSource">{t("employees:form.attendanceSource")}</Label>
            <Select value={formData.attendanceSource} onValueChange={(value) => onSelectChange("attendanceSource", value)}>
              <SelectTrigger id="editAttendanceSource"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="import">{t("employees:form.attendanceSourceImport")}</SelectItem>
                <SelectItem value="system">{t("employees:form.attendanceSourceSystem")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("employees:form.attendanceSourceHint")}</p>
            {formData.attendanceSource === "system" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>{t("employees:form.punchIpExempt")}</Label>
                <Switch checked={formData.punchIpExempt} onCheckedChange={(checked) => onSwitchChange("punchIpExempt", checked)} />
              </div>
            )}
          </div>
          {canSeeSalary && (
            <div className="space-y-2">
              <Label htmlFor="editMonthlySalary">{t("employees:form.monthlySalary")}</Label>
              <Input
                id="editMonthlySalary"
                name="monthlySalary"
                type="number"
                min="0"
                placeholder={t("employees:form.monthlySalaryPlaceholder")}
                value={formData.monthlySalary ?? ""}
                onChange={onFormChange}
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Label htmlFor="active">{t("employees:editDialog.activeStatus")}</Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => onSwitchChange("active", checked)}
            />
            <span className="text-sm text-muted-foreground">
              {formData.active ? t("employees:status.active") : t("employees:status.inactive")}
            </span>
          </div>
          {!formData.active && (
            <>
              <div className="space-y-2">
                <Label htmlFor="editTerminationDate">{t("employees:editDialog.terminationDate")}</Label>
                <Input
                  id="editTerminationDate"
                  name="terminationDate"
                  type="date"
                  value={formData.terminationDate}
                  onChange={onFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editTerminationReason">{t("employees:editDialog.terminationReason")}</Label>
                <Textarea
                  id="editTerminationReason"
                  name="terminationReason"
                  placeholder={t("employees:editDialog.terminationReasonPlaceholder")}
                  value={formData.terminationReason}
                  onChange={onFormChange}
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="editNotes">{t("employees:form.notes")}</Label>
            <Textarea
              id="editNotes"
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

export default EditEmployeeDialog;
