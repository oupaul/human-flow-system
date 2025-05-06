
import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Users,
  UserCircle,
  Edit,
  Trash,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/lib/utils";

// 部門表單驗證結構
const departmentFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, { message: "部門名稱不能為空" }),
  leadName: z.string().min(1, { message: "部門主管不能為空" }),
  parentId: z.number().optional(),
  description: z.string().optional(),
});

type DepartmentFormData = z.infer<typeof departmentFormSchema>;

// 部門資料結構
interface Department {
  id: number;
  name: string;
  leadName: string;
  parentId?: number;
  employeeCount: number;
  description: string;
  parentName?: string;
}

// 模擬資料
const initialDepartmentsData: Department[] = [
  {
    id: 1,
    name: "IT部門",
    leadName: "陳志明",
    employeeCount: 15,
    description: "負責公司所有IT系統的開發和維護，包括內部系統和客戶產品。",
  },
  {
    id: 2,
    name: "人資部門",
    leadName: "王美玲",
    employeeCount: 8,
    description: "負責員工招聘、培訓、績效評估以及所有人力資源相關事務。",
  },
  {
    id: 3,
    name: "財務部門",
    leadName: "林大偉",
    employeeCount: 10,
    description: "負責公司財務規劃、會計、稅務申報和財務報告。",
  },
  {
    id: 4,
    name: "行銷部門",
    leadName: "李小芬",
    employeeCount: 12,
    description: "負責品牌建設、市場策略、產品推廣和社交媒體管理。",
  },
  {
    id: 5,
    name: "業務部門",
    leadName: "張俊傑",
    employeeCount: 18,
    description: "負責客戶開發、關係維護、銷售和商務談判。",
  },
  {
    id: 6,
    name: "研發團隊",
    leadName: "黃建國",
    parentId: 1,
    employeeCount: 8,
    description: "專注於新產品和技術的研發工作。",
  },
  {
    id: 7,
    name: "系統維護團隊",
    leadName: "劉小華",
    parentId: 1,
    employeeCount: 7,
    description: "負責系統維護和技術支持。",
  },
];

const Departments = () => {
  const [departments, setDepartments] = useState<Department[]>(initialDepartmentsData);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  
  const addForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      leadName: "",
      parentId: undefined,
      description: "",
    },
  });
  
  const editForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      leadName: "",
      parentId: undefined,
      description: "",
    },
  });

  // 取得主管部門清單（不包括自己）
  const getParentDepartmentOptions = (currentId?: number) => {
    return departments
      .filter((dept) => !dept.parentId && (!currentId || dept.id !== currentId))
      .map((dept) => ({
        id: dept.id,
        name: dept.name,
      }));
  };
  
  // 根據搜尋條件過濾部門
  const filteredDepartments = departments.filter((department) =>
    department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    department.leadName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // 處理部門新增
  const handleAddDepartment = (data: DepartmentFormData) => {
    const newDepartment: Department = {
      id: Math.max(0, ...departments.map(d => d.id)) + 1,
      name: data.name,
      leadName: data.leadName,
      parentId: data.parentId,
      employeeCount: 0,
      description: data.description || "",
    };
    
    if (data.parentId) {
      const parentDept = departments.find(d => d.id === data.parentId);
      if (parentDept) {
        newDepartment.parentName = parentDept.name;
      }
    }
    
    setDepartments([...departments, newDepartment]);
    setIsAddDialogOpen(false);
    addForm.reset();
    
    toast.success("部門新增成功", {
      description: `已成功新增「${data.name}」部門`,
    });
  };
  
  // 處理部門編輯
  const handleEditDepartment = (data: DepartmentFormData) => {
    if (!selectedDepartment) return;
    
    const updatedDepartments = departments.map((dept) => {
      if (dept.id === selectedDepartment.id) {
        const parentDept = data.parentId ? 
          departments.find(d => d.id === data.parentId) : undefined;
          
        return {
          ...dept,
          name: data.name,
          leadName: data.leadName,
          parentId: data.parentId,
          description: data.description || "",
          parentName: parentDept ? parentDept.name : undefined,
        };
      }
      return dept;
    });
    
    setDepartments(updatedDepartments);
    setIsEditDialogOpen(false);
    setSelectedDepartment(null);
    
    toast.success("部門更新成功", {
      description: `已成功更新「${data.name}」部門的資料`,
    });
  };
  
  // 處理部門刪除
  const handleDeleteDepartment = () => {
    if (!selectedDepartment) return;
    
    // 檢查是否有子部門
    const hasSubDepartments = departments.some(
      dept => dept.parentId === selectedDepartment.id
    );
    
    if (hasSubDepartments) {
      toast.error("無法刪除部門", {
        description: "此部門有子部門存在，請先刪除或移動所有子部門。",
      });
      setIsDeleteDialogOpen(false);
      return;
    }
    
    // 檢查是否有員工
    if (selectedDepartment.employeeCount > 0) {
      toast.error("無法刪除部門", {
        description: "此部門還有員工存在，請先將員工移動到其他部門。",
      });
      setIsDeleteDialogOpen(false);
      return;
    }
    
    const updatedDepartments = departments.filter(
      (dept) => dept.id !== selectedDepartment.id
    );
    
    setDepartments(updatedDepartments);
    setIsDeleteDialogOpen(false);
    setSelectedDepartment(null);
    
    toast.success("部門刪除成功", {
      description: `已成功刪除「${selectedDepartment.name}」部門`,
    });
  };
  
  // 開啟編輯對話框
  const openEditDialog = (department: Department) => {
    setSelectedDepartment(department);
    editForm.reset({
      id: department.id,
      name: department.name,
      leadName: department.leadName,
      parentId: department.parentId,
      description: department.description,
    });
    setIsEditDialogOpen(true);
  };
  
  // 開啟查看對話框
  const openViewDialog = (department: Department) => {
    setSelectedDepartment(department);
    setIsViewDialogOpen(true);
  };
  
  // 開啟刪除對話框
  const openDeleteDialog = (department: Department) => {
    setSelectedDepartment(department);
    setIsDeleteDialogOpen(true);
  };
  
  // 處理搜尋
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // 根據 parentId 分組部門
  const getDepartmentHierarchy = () => {
    const mainDepartments = departments.filter(dept => !dept.parentId);
    
    return mainDepartments.map(mainDept => {
      const subDepartments = departments.filter(
        dept => dept.parentId === mainDept.id
      );
      return {
        main: mainDept,
        sub: subDepartments,
      };
    });
  };
  
  const departmentHierarchy = getDepartmentHierarchy();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">部門管理</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-hrms-accent">
              <Plus className="mr-2 h-4 w-4" /> 新增部門
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>新增部門</DialogTitle>
              <DialogDescription>
                建立新的部門並指派部門主管。
              </DialogDescription>
            </DialogHeader>
            
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(handleAddDepartment)} className="space-y-4">
                <FormField
                  control={addForm.control}
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
                  control={addForm.control}
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
                  control={addForm.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>上級部門</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇上級部門（可選）" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">無上級部門</SelectItem>
                          {getParentDepartmentOptions().map((dept) => (
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
                  control={addForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>部門描述</FormLabel>
                      <FormControl>
                        <Textarea placeholder="簡要描述部門職責" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit">儲存</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* 搜尋欄位 */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          type="search"
          placeholder="搜尋部門或主管..."
          className="pl-9"
          value={searchTerm}
          onChange={handleSearch}
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-10 w-10 text-gray-500"
            onClick={() => setSearchTerm("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* 部門列表 */}
      <div className="space-y-8">
        {searchTerm ? (
          // 搜尋結果顯示平鋪列表
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDepartments.map((department) => (
              <Card key={department.id} className="overflow-hidden">
                <CardHeader className="bg-hrms-primary text-white pb-3">
                  <CardTitle>{department.name}</CardTitle>
                  <CardDescription className="text-gray-200 mt-1">
                    <div className="flex items-center">
                      <UserCircle className="h-4 w-4 mr-1" />
                      主管: {department.leadName}
                    </div>
                    <div className="flex items-center mt-1">
                      <Users className="h-4 w-4 mr-1" />
                      {department.employeeCount} 位員工
                    </div>
                    {department.parentId && (
                      <div className="text-gray-200 mt-1">
                        上級部門: {department.parentName}
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-gray-600">{department.description}</p>
                </CardContent>
                <CardFooter className="flex justify-between border-t bg-gray-50 px-6 py-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openViewDialog(department)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    檢視部門
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(department)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openDeleteDialog(department)}
                    >
                      <Trash className="h-4 w-4 text-hrms-danger" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          // 常規顯示（層次結構）
          departmentHierarchy.map((hierarchy) => (
            <div key={hierarchy.main.id} className="space-y-4">
              <div className="flex items-center">
                <h2 className="text-lg font-semibold">{hierarchy.main.name}</h2>
                <span className="ml-2 rounded-full bg-hrms-primary px-2.5 py-0.5 text-xs text-white">
                  {hierarchy.main.employeeCount} 位員工
                </span>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="overflow-hidden">
                  <CardHeader className="bg-hrms-primary text-white pb-3">
                    <CardTitle>{hierarchy.main.name}</CardTitle>
                    <CardDescription className="text-gray-200 mt-1">
                      <div className="flex items-center">
                        <UserCircle className="h-4 w-4 mr-1" />
                        主管: {hierarchy.main.leadName}
                      </div>
                      <div className="flex items-center mt-1">
                        <Users className="h-4 w-4 mr-1" />
                        {hierarchy.main.employeeCount} 位員工
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600">{hierarchy.main.description}</p>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t bg-gray-50 px-6 py-3">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openViewDialog(hierarchy.main)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      檢視部門
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(hierarchy.main)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openDeleteDialog(hierarchy.main)}
                      >
                        <Trash className="h-4 w-4 text-hrms-danger" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
                
                {hierarchy.sub.map((subDept) => (
                  <Card key={subDept.id} className="overflow-hidden border-l-4 border-l-hrms-accent">
                    <CardHeader className="bg-gray-100 pb-3">
                      <CardTitle>{subDept.name}</CardTitle>
                      <CardDescription className="text-gray-600 mt-1">
                        <div className="flex items-center">
                          <UserCircle className="h-4 w-4 mr-1" />
                          主管: {subDept.leadName}
                        </div>
                        <div className="flex items-center mt-1">
                          <Users className="h-4 w-4 mr-1" />
                          {subDept.employeeCount} 位員工
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          上級部門: {hierarchy.main.name}
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-sm text-gray-600">{subDept.description}</p>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t bg-gray-50 px-6 py-3">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openViewDialog(subDept)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        檢視部門
                      </Button>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditDialog(subDept)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openDeleteDialog(subDept)}
                        >
                          <Trash className="h-4 w-4 text-hrms-danger" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* 部門詳情對話框 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedDepartment && (
            <>
              <DialogHeader>
                <DialogTitle>部門詳情</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedDepartment.name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedDepartment.parentId ? "子部門" : "主要部門"}
                  </p>
                </div>
                
                <div className="grid gap-4">
                  <div>
                    <h4 className="text-sm font-medium">部門主管</h4>
                    <p>{selectedDepartment.leadName}</p>
                  </div>
                  
                  {selectedDepartment.parentId && selectedDepartment.parentName && (
                    <div>
                      <h4 className="text-sm font-medium">上級部門</h4>
                      <p>{selectedDepartment.parentName}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="text-sm font-medium">員工數量</h4>
                    <p>{selectedDepartment.employeeCount} 人</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium">部門描述</h4>
                    <p className="text-sm text-gray-600">{selectedDepartment.description}</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsViewDialogOpen(false)}>關閉</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 編輯部門對話框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>編輯部門</DialogTitle>
            <DialogDescription>
              修改部門資料和結構。
            </DialogDescription>
          </DialogHeader>
          
          {selectedDepartment && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditDepartment)} className="space-y-4">
                <FormField
                  control={editForm.control}
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
                  control={editForm.control}
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
                  control={editForm.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>上級部門</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇上級部門（可選）" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">無上級部門</SelectItem>
                          {getParentDepartmentOptions(selectedDepartment.id).map((dept) => (
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
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>部門描述</FormLabel>
                      <FormControl>
                        <Textarea placeholder="簡要描述部門職責" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit">更新</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 刪除確認對話框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除部門</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDepartment && (
                <>
                  您確定要刪除「{selectedDepartment.name}」部門嗎？<br />
                  只有無員工和無子部門的部門才能被刪除。此操作無法撤銷。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-hrms-danger" 
              onClick={handleDeleteDepartment}
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Departments;
