import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import TodayTab from "@/components/punch/TodayTab";
import EventsTab from "@/components/punch/EventsTab";
import DevicesTab from "@/components/punch/DevicesTab";
import AttendanceSettingsTab from "@/components/punch/AttendanceSettingsTab";

// HR／主管的打卡管理：今日出勤、打卡紀錄（admin/hr 可作廢與補登）、裝置綁定與設定（僅 admin/hr）
const Punch = () => {
  const { t } = useTranslation(["punch", "common"]);
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "hr";
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") ?? "today";
  const tab = !canManage && (requested === "devices" || requested === "settings") ? "today" : requested;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.punch")}</h1>
        <p className="text-sm text-muted-foreground">{t("punch:page.description")}</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === "today" ? {} : { tab: v })}>
        <TabsList>
          <TabsTrigger value="today">{t("punch:tabs.today")}</TabsTrigger>
          <TabsTrigger value="events">{t("punch:tabs.events")}</TabsTrigger>
          {canManage && <TabsTrigger value="devices">{t("punch:tabs.devices")}</TabsTrigger>}
          {canManage && <TabsTrigger value="settings">{t("punch:tabs.settings")}</TabsTrigger>}
        </TabsList>
        <TabsContent value="today"><TodayTab /></TabsContent>
        <TabsContent value="events"><EventsTab canEdit={canManage} /></TabsContent>
        {canManage && <TabsContent value="devices"><DevicesTab /></TabsContent>}
        {canManage && <TabsContent value="settings"><AttendanceSettingsTab /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default Punch;
