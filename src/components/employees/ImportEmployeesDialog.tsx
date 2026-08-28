import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { ImportEmployeesResult } from "@/services/employeeApi";

interface ImportEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (csv: string) => Promise<ImportEmployeesResult | null>;
}

const SAMPLE_CSV = "姓名,員工編號,部門,職位,電子郵件,電話,到職日,地址,備註,月薪,已用特休天數\n王小明,EMP101,資訊部,工程師,wang@example.com,0912345678,2020/03/01,,,50000,2";

const ImportEmployeesDialog = ({ open, onOpenChange, onImport }: ImportEmployeesDialogProps) => {
  const [csv, setCsv] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportEmployeesResult | null>(null);

  const reset = () => {
    setCsv("");
    setResult(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(file, "utf-8");
  };

  const handleSubmit = async () => {
    if (!csv.trim()) return;
    setIsSubmitting(true);
    const importResult = await onImport(csv);
    setResult(importResult);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>批次匯入員工</DialogTitle>
          <DialogDescription>
            上傳 CSV 檔案，或直接貼上內容。標題列需包含「姓名、員工編號、部門、職位、電子郵件、到職日」，電話/地址/備註/月薪/已用特休天數為選填。每位員工會自動建立登入帳號（帳號＝電子郵件、預設密碼＝員工編號）。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="csvFile">上傳 CSV 檔案</Label>
            <Input id="csvFile" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="csvText">或貼上 CSV 內容</Label>
            <Textarea
              id="csvText"
              rows={8}
              placeholder={SAMPLE_CSV}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {result && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <p>
                成功新增 <strong className="text-green-600">{result.created}</strong> 筆
                {result.failed.length > 0 && (
                  <>，失敗 <strong className="text-red-600">{result.failed.length}</strong> 筆</>
                )}
              </p>
              {result.failed.length > 0 && (
                <div className="max-h-40 overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">CSV 第幾列</th>
                        <th className="p-2 text-left">員工編號</th>
                        <th className="p-2 text-left">失敗原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failed.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{item.row}</td>
                          <td className="p-2">{item.employeeId}</td>
                          <td className="p-2 text-red-600">{item.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            關閉
          </Button>
          <Button onClick={handleSubmit} disabled={!csv.trim() || isSubmitting}>
            <Upload className="mr-2 h-4 w-4" />
            {isSubmitting ? "匯入中..." : "開始匯入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportEmployeesDialog;
