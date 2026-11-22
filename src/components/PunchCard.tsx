import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Fingerprint, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { punchApi } from "@/services/punchApi";
import { PunchStatus } from "@/types/punch";

const pad = (n: number) => String(n).padStart(2, "0");

// 員工自助頁的打卡卡片：時間一律以伺服器為準（畫面上的時鐘是以伺服器時間為起點跳動，不是手機時間）。
// 只有出勤來源設為「系統打卡」的員工才會顯示
const PunchCard = () => {
  const { t } = useTranslation(["punch", "common"]);
  const [status, setStatus] = useState<PunchStatus | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await punchApi.getStatus();
      setStatus(data);
      // serverTime 是台北時間字串；以「瀏覽器當地」方式解析後只拿來顯示，自己再跳秒，所以顯示的就是伺服器的台北時間
      offsetRef.current = new Date(data.serverTime.replace(" ", "T")).getTime() - Date.now();
    } catch (error) {
      console.error("Failed to load punch status:", error);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!status?.enabled) return;
    const timer = setInterval(() => setNow(new Date(Date.now() + offsetRef.current)), 1000);
    setNow(new Date(Date.now() + offsetRef.current));
    return () => clearInterval(timer);
  }, [status?.enabled]);

  if (!status?.enabled) return null;

  const next = status.nextType ?? "in";
  const handlePunch = async () => {
    try {
      setBusy(true);
      const result = await punchApi.punch(next);
      toast.success(result.message, { description: result.punchAt });
      await load();
    } catch (error) {
      toast.error(t("punch:card.failed"), { description: error instanceof Error ? error.message : undefined, duration: 8000 });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const clock = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : "--:--:--";
  const warnings: string[] = [];
  if (status.ipAllowed === false) warnings.push(t("punch:card.ipBlocked", { ip: status.ip }));
  if (status.deviceBinding === "enforce") {
    if (status.deviceState === "pending") warnings.push(t("punch:card.devicePending"));
    if (status.deviceState === "revoked") warnings.push(t("punch:card.deviceRevoked"));
    if (status.deviceState === "other") warnings.push(t("punch:card.deviceOther"));
    if (status.deviceState === "unknown") warnings.push(t("punch:card.deviceNew"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5" /> {t("punch:card.title")}</CardTitle>
        <CardDescription>{status.today} · {t("punch:card.serverTimeHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-4xl font-semibold tabular-nums">{clock}</div>
          <Button size="lg" onClick={handlePunch} disabled={busy} className={next === "in" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}>
            {next === "in" ? t("punch:card.punchIn") : t("punch:card.punchOut")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {status.open ? t("punch:card.stateOpen") : t("punch:card.stateIdle")}
          </p>
        </div>
        {(status.todayEvents?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {status.todayEvents!.map((e, i) => (
              <span key={i} className="rounded-md border px-2 py-1">
                {t(`punch:types.${e.type}`)} {e.time.slice(0, 5)}
              </span>
            ))}
          </div>
        )}
        {warnings.map((w) => (
          <p key={w} className="flex items-start gap-2 text-sm text-amber-700"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>
        ))}
      </CardContent>
    </Card>
  );
};

export default PunchCard;
