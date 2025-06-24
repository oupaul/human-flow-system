
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
import { EmployeeFormData, departmentOptions } from "@/types/employee";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>編輯員工資料</DialogTitle>
          <DialogDescription>
            修改員工的基本資料。所有帶*的欄位為必填。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editName">姓名 *</Label>
              <Input 
                id="editName" 
                name="name"
                placeholder="輸入姓名" 
                value={formData.name}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmployeeId">員工編號 *</Label>
              <Input 
                id="editEmployeeId" 
                name="employeeId"
                placeholder="如: EMP001" 
                value={formData.employeeId}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editDepartment">部門 *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => onSelectChange("department", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇部門" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.slice(1).map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPosition">職位 *</Label>
              <Input 
                id="editPosition" 
                name="position"
                placeholder="輸入職位" 
                value={formData.position}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editEmail">電子郵件 *</Label>
              <Input 
                id="editEmail" 
                name="email"
                type="email" 
                placeholder="name@example.com" 
                value={formData.email}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">電話號碼</Label>
              <Input 
                id="editPhone" 
                name="phone"
                placeholder="如: 0912-345-678" 
                value={formData.phone}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editJoinDate">到職日期 *</Label>
              <Input 
                id="editJoinDate" 
                name="joinDate"
                type="date" 
                value={formData.joinDate}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">地址</Label>
              <Input 
                id="editAddress" 
                name="address"
                placeholder="輸入地址" 
                value={formData.address}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="active">在職狀態</Label>
            <Switch 
              id="active" 
              checked={formData.active} 
              onCheckedChange={(checked) => onSwitchChange("active", checked)}
            />
            <span className="text-sm text-muted-foreground">
              {formData.active ? "在職中" : "已離職"}
            </span>
          </div>
          {!formData.active && (
            <>
              <div className="space-y-2">
                <Label htmlFor="editTerminationDate">離職日期</Label>
                <Input 
                  id="editTerminationDate" 
                  name="terminationDate"
                  type="date" 
                  value={formData.terminationDate}
                  onChange={onFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editTerminationReason">離職原因</Label>
                <Textarea 
                  id="editTerminationReason" 
                  name="terminationReason"
                  placeholder="輸入離職原因" 
                  value={formData.terminationReason}
                  onChange={onFormChange}
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="editNotes">備註</Label>
            <Textarea 
              id="editNotes" 
              name="notes"
              placeholder="輸入備註" 
              value={formData.notes}
              onChange={onFormChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditEmployeeDialog;
