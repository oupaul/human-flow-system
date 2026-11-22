import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Holiday } from "@/types/holiday";
import { holidayApi } from "@/services/holidayApi";

export const useHolidays = (year: number) => {
  const { t } = useTranslation(["leaveManagement", "common"]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const data = await holidayApi.getHolidays(year);
      setHolidays(data);
    } catch (error) {
      console.error("Failed to load holidays:", error);
      toast.error(t("leaveManagement:holidays.toasts.loadFailed"), {
        description: t("common:common.networkErrorHint"),
      });
    } finally {
      setLoading(false);
    }
  }, [year, t]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const importHolidays = async (csv: string) => {
    try {
      const result = await holidayApi.importHolidays(csv);
      await loadHolidays();
      toast.success(t("leaveManagement:holidays.toasts.importSuccessTitle"), {
        description: t("leaveManagement:holidays.toasts.importSuccessDescription", { count: result.imported }),
      });
    } catch (error) {
      console.error("Failed to import holidays:", error);
      toast.error(t("leaveManagement:holidays.toasts.importFailedTitle"), {
        description: error instanceof Error ? error.message : t("leaveManagement:holidays.toasts.importFailedFallback"),
      });
    }
  };

  const [syncing, setSyncing] = useState(false);

  const syncHolidays = async () => {
    try {
      setSyncing(true);
      const result = await holidayApi.syncHolidays();
      await loadHolidays();
      toast.success(t("leaveManagement:holidays.toasts.syncSuccessTitle"), {
        description: t("leaveManagement:holidays.toasts.syncSuccessDescription", {
          count: result.imported,
          years: result.years.join("、"),
        }),
      });
    } catch (error) {
      console.error("Failed to sync holidays:", error);
      toast.error(t("leaveManagement:holidays.toasts.syncFailedTitle"), {
        description: error instanceof Error ? error.message : t("common:common.networkErrorHint"),
      });
    } finally {
      setSyncing(false);
    }
  };

  const createHoliday = async (data: { date: string; name?: string; isHoliday: boolean }) => {
    try {
      await holidayApi.createHoliday(data);
      await loadHolidays();
      toast.success(t("leaveManagement:holidays.toasts.createSuccess"));
    } catch (error) {
      console.error("Failed to create holiday:", error);
      toast.error(t("leaveManagement:holidays.toasts.createFailedTitle"), {
        description: t("common:common.networkErrorHint"),
      });
    }
  };

  const deleteHoliday = async (id: number) => {
    try {
      await holidayApi.deleteHoliday(id);
      await loadHolidays();
      toast.success(t("leaveManagement:holidays.toasts.deleteSuccess"));
    } catch (error) {
      console.error("Failed to delete holiday:", error);
      toast.error(t("leaveManagement:holidays.toasts.deleteFailedTitle"), {
        description: t("common:common.networkErrorHint"),
      });
    }
  };

  return {
    holidays,
    loading,
    importHolidays,
    syncHolidays,
    syncing,
    createHoliday,
    deleteHoliday,
    reload: loadHolidays,
  };
};
