import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeFormData } from "@/types/employee";

interface Props {
  idPrefix: string;
  formData: EmployeeFormData;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (name: string, value: string) => void;
}

// 工時制度：一般工時或二週變形工時（公司需已向勞工局核備；排班檢查依此套用不同規則）
const WorkTimeFields = ({ idPrefix, formData, onFormChange, onSelectChange }: Props) => {
  const { t } = useTranslation("employees");
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}WorkTimeMode`}>{t("form.workTimeMode")}</Label>
      <Select value={formData.workTimeMode} onValueChange={(value) => onSelectChange("workTimeMode", value)}>
        <SelectTrigger id={`${idPrefix}WorkTimeMode`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="standard">{t("form.workTimeStandard")}</SelectItem>
          <SelectItem value="flex2w">{t("form.workTimeFlex2w")}</SelectItem>
        </SelectContent>
      </Select>
      {formData.workTimeMode === "flex2w" && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}WorkTimeCycleStart`}>{t("form.workTimeCycleStart")}</Label>
          <Input id={`${idPrefix}WorkTimeCycleStart`} name="workTimeCycleStart" type="date" value={formData.workTimeCycleStart} onChange={onFormChange} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("form.workTimeHint")}</p>
    </div>
  );
};

export default WorkTimeFields;
