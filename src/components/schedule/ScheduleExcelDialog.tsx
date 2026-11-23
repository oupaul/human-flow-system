import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FillPreviewBox from "@/components/schedule/FillPreviewBox";
import { scheduleApi } from "@/services/scheduleApi";
import { ExcelPreview, ScheduleEmployee } from "@/types/schedule";

const CHUNK = 800; // 一次送出的格數（後端 JSON 上限約 100 KB）

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  department: string;
  employees: ScheduleEmployee[];
  onDone: () => void;
}

// Excel 匯入／匯出班表（矩陣格式）：下載的檔案含目前班表，改完可直接匯入；匯入前先預覽
const ScheduleExcelDialog = ({ open, onOpenChange, month, department, employees, onDone }: Props) => {
  const { t } = useTranslation(["schedule", "common"]);
  const [parsed, setParsed] = useState<ExcelPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const names = new Map(employees.map((e) => [e.employeeId, e.name]));

  const reset = () => { setParsed(null); setFileName(""); };

  const download = async () => {
    try {
      setBusy(true);
      const blob = await scheduleApi.downloadExcel(month, department === "all" ? undefined : department);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setBusy(true);
      setFileName(file.name);
      setParsed(await scheduleApi.previewExcel(file, month));
    } catch (error) {
      setParsed(null);
      toast.error(t("schedule:excel.parseFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!parsed || parsed.cells.length === 0) return;
    try {
      setBusy(true);
      let changed = 0;
      for (let i = 0; i < parsed.cells.length; i += CHUNK) {
        changed += (await scheduleApi.setCells(parsed.cells.slice(i, i + CHUNK))).changed;
      }
      toast.success(t("schedule:excel.done", { count: changed }));
      reset();
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />{t("schedule:excel.title")}</DialogTitle>
          <DialogDescription>{t("schedule:excel.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">{t("schedule:excel.step1")}</div>
            <Button variant="outline" onClick={download} disabled={busy}><Download className="mr-2 h-4 w-4" />{t("schedule:excel.download", { month })}</Button>
            <p className="mt-2 text-xs text-muted-foreground">{t("schedule:excel.downloadHint")}</p>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">{t("schedule:excel.step2")}</div>
            <label className="inline-flex cursor-pointer items-center">
              <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={pick} disabled={busy} />
              <span className="inline-flex h-10 items-center rounded-md border bg-white px-4 text-sm hover:bg-gray-50"><Upload className="mr-2 h-4 w-4" />{t("schedule:excel.choose")}</span>
            </label>
            {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}
          </div>

          {parsed && (
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm">
                <div>{t("schedule:excel.summary", { employees: parsed.employees, cells: parsed.cells.length, from: parsed.from, to: parsed.to })}</div>
                {parsed.cells.length === 0 && <div className="mt-1 text-amber-700">{t("schedule:excel.noCells")}</div>}
              </div>
              {parsed.errorTotal > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <div className="mb-1 font-medium text-amber-800">{t("schedule:excel.errors", { count: parsed.errorTotal })}</div>
                  <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                    {parsed.errors.map((er, i) => <li key={i}>{t("schedule:excel.rowPrefix", { row: er.row })}{er.message}</li>)}
                  </ul>
                  {parsed.errorTotal > parsed.errors.length && <div className="mt-1 text-xs text-muted-foreground">{t("schedule:check.quickFill.more", { count: parsed.errorTotal - parsed.errors.length })}</div>}
                </div>
              )}
              <FillPreviewBox preview={parsed.preview} loading={false} names={names} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>{t("common:actions.cancel")}</Button>
          <Button disabled={busy || !parsed || parsed.cells.length === 0} onClick={apply}>{t("schedule:excel.apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleExcelDialog;
