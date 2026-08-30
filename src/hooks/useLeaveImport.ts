import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LeaveImportResult } from "@/types/leaveImport";
import { leaveImportApi } from "@/services/leaveImportApi";

export const useLeaveImport = (onImported?: () => void) => {
  const { t } = useTranslation(["reports", "common"]);
  const [isImporting, setIsImporting] = useState(false);

  const importFile = async (file: File): Promise<LeaveImportResult | null> => {
    setIsImporting(true);
    try {
      const result = await leaveImportApi.importLeaves(file);
      onImported?.();
      if (result.unmatchedAccounts.length > 0) {
        toast.warning(t("reports:leave.toasts.importPartial", { count: result.imported }), {
          description: t("reports:leave.toasts.unmatchedAccounts", { accounts: result.unmatchedAccounts.join("、") }),
          duration: 15000,
        });
      } else {
        toast.success(t("reports:leave.toasts.importSuccess", { count: result.imported }));
      }
      return result;
    } catch (error) {
      console.error("Failed to import leave records:", error);
      toast.error(t("reports:leave.toasts.importFailed"), {
        description: error instanceof Error ? error.message : t("common:common.networkErrorHint"),
      });
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  return { isImporting, importFile };
};
