
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, UserCircle, Edit, Trash } from "lucide-react";

// Mock data
const departmentsData = [
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
];

const Departments = () => {
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">部門管理</h1>
        <Dialog open={isAddDepartmentOpen} onOpenChange={setIsAddDepartmentOpen}>
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
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">部門名稱</Label>
                <Input id="name" placeholder="輸入部門名稱" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead">部門主管</Label>
                <Input id="lead" placeholder="輸入部門主管姓名" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">部門描述</Label>
                <Input id="description" placeholder="簡要描述部門職責" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDepartmentOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsAddDepartmentOpen(false)}>
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {departmentsData.map((department) => (
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
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-600">{department.description}</p>
            </CardContent>
            <CardFooter className="flex justify-between border-t bg-gray-50 px-6 py-3">
              <Button variant="ghost" size="sm">
                <Users className="mr-2 h-4 w-4" />
                檢視員工
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Trash className="h-4 w-4 text-hrms-danger" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Departments;
