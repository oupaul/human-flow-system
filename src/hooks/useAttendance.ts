import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AttendanceSummaryRow, AttendanceImportResult } from "@/types/attendance";
import { attendanceApi } from "@/services/attendanceApi";

export const useAttendance = (year: number, month: number) => {
  const { t } = useTranslation(["reports", "common"]);
  const [summary, setSummary] = useState<AttendanceSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const data = await attendanceApi.getSummary(year, month);
      setSummary(data);
    } catch (error) {
      console.error("Failed to load attendance summary:", error);
      toast.error(t("reports:attendance.toasts.loadFailed"), {
        description: t("common:common.networkErrorHint"),
      });
    } finally {
      setLoading(false);
    }
  }, [year, month, t]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const importFile = async (file: File, importYear: number): Promise<AttendanceImportResult | null> => {
    setIsImporting(true);
    try {
      const result = await attendanceApi.importAttendance(file, importYear);
      await loadSummary();
      if (result.unmatchedAccounts.length > 0) {
        toast.warning(t("reports:attendance.toasts.importPartial", { count: result.imported }), {
          description: t("reports:attendance.toasts.unmatchedAccounts", { accounts: result.unmatchedAccounts.join("、") }),
          duration: 15000,
        });
      } else {
        toast.success(t("reports:attendance.toasts.importSuccess", { count: result.imported }));
      }
      return result;
    } catch (error) {
      console.error("Failed to import attendance:", error);
      toast.error(t("reports:attendance.toasts.importFailed"), {
        description: error instanceof Error ? error.message : t("common:common.networkErrorHint"),
      });
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  return {
    summary,
    loading,
    isImporting,
    importFile,
    reload: loadSummary,
  };
};
