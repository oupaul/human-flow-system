import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarDays, FilePenLine, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { punchApi } from "@/services/punchApi";
import { scheduleApi } from "@/services/scheduleApi";
import { punchRequestApi } from "@/services/punchRequestApi";
import { todayStr, toLocalDateStr } from "@/lib/taipeiDate";
import { ScheduleCell } from "@/types/schedule";
import { CorrectionRequest, OutingRequest } from "@/types/punchRequests";

// 員工自助頁：我的班表（已發布）、補卡申請、公出申請與我的申請紀錄。只有使用系統打卡的員工才會顯示
const PunchExtras = () => {
  const { t } = useTranslation(["punch", "schedule", "common"]);
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleCell[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [outings, setOutings] = useState<OutingRequest[]>([]);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [outingOpen, setOutingOpen] = useState(false);
  const [cForm, setCForm] = useState({ workDate: todayStr(), type: "in" as "in" | "out", time: "", reason: "" });
  const [oForm, setOForm] = useState({ startDate: todayStr(), endDate: todayStr(), destination: "", reason: "" });

  const load = useCallback(async () => {
    try {
      const status = await punchApi.getStatus();
      setEnabled(status.enabled);
      if (!status.enabled) return;
      const end = new Date();
      end.setDate(end.getDate() + 13);
      const [s, c, o] = await Promise.all([
        scheduleApi.getMine(todayStr(), toLocalDateStr(end)), punchRequestApi.listCorrections(), punchRequestApi.listOutings(),
      ]);
      setSchedule(s);
      setCorrections(c.slice(0, 5));
      setOutings(o.slice(0, 5));
    } catch (error) {
      console.error("Failed to load punch extras:", error);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  if (!enabled) return null;

  const submit = async (action: () => Promise<{ message: string }>, close: () => void) => {
    try {
      const result = await action();
      toast.success(result.message);
      close();
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined, duration: 8000 });
    }
  };

  const statusBadge = (s: string) => <Badge variant={s === "pending" ? "default" : s === "approved" ? "secondary" : "outline"}>{t(`punch:requests.status.${s}`)}</Badge>;
  const label = (c: ScheduleCell) => (c.kind === "off" ? t(`schedule:off.${c.offType}`) : `${c.shiftName} ${c.startTime}~${c.endTime}`);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{t("punch:extras.scheduleTitle")}</CardTitle>
            <CardDescription>{t("punch:extras.scheduleHint")}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCorrectionOpen(true)}><FilePenLine className="mr-2 h-4 w-4" />{t("punch:extras.correctionButton")}</Button>
            <Button variant="outline" onClick={() => setOutingOpen(true)}><MapPin className="mr-2 h-4 w-4" />{t("punch:extras.outingButton")}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("punch:extras.noSchedule")}</p>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm">
              {schedule.map((c) => (
                <span key={c.date} className={`rounded-md border px-2 py-1 ${c.kind === "off" ? "bg-sky-50" : ""}`}>
                  <span className="text-muted-foreground">{c.date.slice(5)}</span> {label(c)}
                </span>
              ))}
            </div>
          )}
          {(corrections.length > 0 || outings.length > 0) && (
            <div className="space-y-1 border-t pt-3 text-sm">
              <h4 className="font-semibold">{t("punch:extras.myRequests")}</h4>
              {corrections.map((r) => (
                <div key={`c${r.id}`} className="flex items-center gap-2">
                  {statusBadge(r.status)}<span>{t("punch:extras.correctionLine", { date: r.workDate, type: t(`punch:types.${r.type}`), time: r.requestedTime })}</span>
                  {r.reviewNote && <span className="text-xs text-muted-foreground">（{r.reviewNote}）</span>}
                </div>
              ))}
              {outings.map((r) => (
                <div key={`o${r.id}`} className="flex items-center gap-2">
                  {statusBadge(r.status)}<span>{t("punch:extras.outingLine", { start: r.startDate, end: r.endDate, destination: r.destination })}</span>
                  {r.reviewNote && <span className="text-xs text-muted-foreground">（{r.reviewNote}）</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("punch:extras.correctionButton")}</DialogTitle><DialogDescription>{t("punch:extras.correctionDescription")}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t("common:table.date")}</Label><Input type="date" max={todayStr()} value={cForm.workDate} onChange={(e) => setCForm({ ...cForm, workDate: e.target.value })} /></div>
              <div className="space-y-1"><Label>{t("punch:events.clockTime")}</Label><Input type="time" value={cForm.time} onChange={(e) => setCForm({ ...cForm, time: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>{t("punch:events.type")}</Label>
              <Select value={cForm.type} onValueChange={(v) => setCForm({ ...cForm, type: v as "in" | "out" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="in">{t("punch:types.in")}</SelectItem><SelectItem value="out">{t("punch:types.out")}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t("punch:events.reason")}</Label><Textarea value={cForm.reason} onChange={(e) => setCForm({ ...cForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button disabled={!cForm.time || !cForm.reason.trim()} onClick={() => submit(() => punchRequestApi.createCorrection(cForm), () => { setCorrectionOpen(false); setCForm({ ...cForm, time: "", reason: "" }); })}>{t("common:actions.submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={outingOpen} onOpenChange={setOutingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("punch:extras.outingButton")}</DialogTitle><DialogDescription>{t("punch:extras.outingDescription")}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t("punch:extras.startDate")}</Label><Input type="date" min={todayStr()} value={oForm.startDate} onChange={(e) => setOForm({ ...oForm, startDate: e.target.value, endDate: e.target.value > oForm.endDate ? e.target.value : oForm.endDate })} /></div>
              <div className="space-y-1"><Label>{t("punch:extras.endDate")}</Label><Input type="date" min={oForm.startDate} value={oForm.endDate} onChange={(e) => setOForm({ ...oForm, endDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>{t("punch:requests.destination")}</Label><Input value={oForm.destination} onChange={(e) => setOForm({ ...oForm, destination: e.target.value })} placeholder={t("punch:extras.destinationPlaceholder")} /></div>
            <div className="space-y-1"><Label>{t("punch:extras.note")}</Label><Textarea value={oForm.reason} onChange={(e) => setOForm({ ...oForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutingOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button disabled={!oForm.destination.trim()} onClick={() => submit(() => punchRequestApi.createOuting(oForm), () => { setOutingOpen(false); setOForm({ ...oForm, destination: "", reason: "" }); })}>{t("common:actions.submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PunchExtras;
