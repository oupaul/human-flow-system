
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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["departments", "common"]);

  console.log("EditDepartmentDialog rendered", {
    open,
    formValues: form.getValues(),
    parentOptions
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("departments:editDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("departments:editDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("departments:form.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("departments:form.namePlaceholder")} {...field} />
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
                  <FormLabel>{t("departments:form.leadLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("departments:form.leadPlaceholder")} {...field} />
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
                  <FormLabel>{t("departments:form.parentLabel")}</FormLabel>
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
                        <SelectValue placeholder={t("departments:form.parentPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t("departments:form.noParent")}</SelectItem>
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
                  <FormLabel>{t("departments:form.descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("departments:form.descriptionPlaceholder")}
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
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit">{t("departments:editDialog.submitButton")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditDepartmentDialog;
