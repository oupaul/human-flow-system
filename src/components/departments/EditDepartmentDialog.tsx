
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { DepartmentFormData, ParentDepartmentOption } from "@/types/department";

interface EditDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<DepartmentFormData>;
  parentOptions: ParentDepartmentOption[];
  onSubmit: (data: DepartmentFormData) => void;
}

const EditDepartmentDialog = ({
  open,
  onOpenChange,
  form,
  parentOptions,
  onSubmit,
}: EditDepartmentDialogProps) => {
  console.log("EditDepartmentDialog rendered", { 
    open, 
    formValues: form.getValues(),
    parentOptions 
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>編輯部門</DialogTitle>
          <DialogDescription>
            修改部門資料和結構。
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門名稱</FormLabel>
                  <FormControl>
                    <Input placeholder="輸入部門名稱" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="leadName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門主管</FormLabel>
                  <FormControl>
                    <Input placeholder="輸入部門主管姓名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>上級部門</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      console.log("Parent department changed:", value);
                      if (value === "none") {
                        field.onChange(undefined);
                      } else {
                        field.onChange(Number(value));
                      }
                    }}
                    value={field.value ? field.value.toString() : "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇上級部門（可選）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">無上級部門</SelectItem>
                      {parentOptions.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門描述</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="簡要描述部門職責" 
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit">更新</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditDepartmentDialog;
