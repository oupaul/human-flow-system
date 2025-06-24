
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
import { EmployeeFormData, departmentOptions } from "@/types/employee";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>新增員工</DialogTitle>
          <DialogDescription>
            填寫新員工的基本資料。所有帶*的欄位為必填。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input 
                id="name" 
                name="name"
                placeholder="輸入姓名" 
                value={formData.name}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeId">員工編號 *</Label>
              <Input 
                id="employeeId" 
                name="employeeId"
                placeholder="如: EMP001" 
                value={formData.employeeId}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">部門 *</Label>
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
              <Label htmlFor="position">職位 *</Label>
              <Input 
                id="position" 
                name="position"
                placeholder="輸入職位" 
                value={formData.position}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">電子郵件 *</Label>
              <Input 
                id="email" 
                name="email"
                type="email" 
                placeholder="name@example.com" 
                value={formData.email}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話號碼</Label>
              <Input 
                id="phone" 
                name="phone"
                placeholder="如: 0912-345-678" 
                value={formData.phone}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="joinDate">到職日期 *</Label>
              <Input 
                id="joinDate" 
                name="joinDate"
                type="date" 
                value={formData.joinDate}
                onChange={onFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">地址</Label>
              <Input 
                id="address" 
                name="address"
                placeholder="輸入地址" 
                value={formData.address}
                onChange={onFormChange}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">備註</Label>
            <Textarea 
              id="notes" 
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

export default AddEmployeeDialog;
