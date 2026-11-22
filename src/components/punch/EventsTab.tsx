import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { punchApi } from "@/services/punchApi";
import { PunchEvent, PunchType } from "@/types/punch";
import { toLocalDateStr, todayStr } from "@/lib/taipeiDate";

const PAGE_SIZE = 50;

const EventsTab = ({ canEdit }: { canEdit: boolean }) => {
  const { t } = useTranslation(["punch", "common"]);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [from, setFrom] = useState(toLocalDateStr(weekAgo));
  const [to, setTo] = useState(todayStr());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<PunchEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [voiding, setVoiding] = useState<PunchEvent | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState({ employeeId: "", date: todayStr(), time: "", type: "out" as PunchType, reason: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await punchApi.getEvents({ from, to, q: q.trim(), status, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(data.rows);
      setTotal(data.total);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [from, to, q, status, page, t]);

  useEffect(() => { load(); }, [load]);

  const submitVoid = async () => {
    if (!voiding) return;
    try {
      await punchApi.voidEvent(voiding.id, voidReason);
      toast.success(t("punch:events.voidDone"));
      setVoiding(null);
      setVoidReason("");
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const submitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await punchApi.correction(correction);
      toast.success(t("punch:events.correctionDone"));
      setCorrectionOpen(false);
      setCorrection({ ...correction, time: "", reason: "" });
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const flagLabel = (flags: string | null) =>
    flags ? flags.split(",").map((f) => t(`punch:flags.${f}`, { defaultValue: f })).join("、") : "";
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label>{t("punch:events.from")}</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></div>
        <div className="space-y-1"><Label>{t("punch:events.to")}</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></div>
        <div className="space-y-1"><Label>{t("punch:events.search")}</Label><Input className="w-56" placeholder={t("punch:events.searchPlaceholder")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <div className="space-y-1">
          <Label>{t("common:table.status")}</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("punch:events.statusAll")}</SelectItem>
              <SelectItem value="valid">{t("punch:events.statusValid")}</SelectItem>
              <SelectItem value="voided">{t("punch:events.statusVoided")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="pb-2 text-sm text-muted-foreground">{t("punch:events.total", { count: total })}</span>
        {canEdit && (
          <Button className="ml-auto bg-hrms-accent" onClick={() => setCorrectionOpen(true)}><Plus className="mr-2 h-4 w-4" />{t("punch:events.addCorrection")}</Button>
        )}
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("punch:events.time")}</TableHead>
              <TableHead>{t("common:table.name")}</TableHead>
              <TableHead>{t("punch:events.type")}</TableHead>
              <TableHead>{t("punch:events.source")}</TableHead>
              <TableHead>{t("punch:events.device")}</TableHead>
              <TableHead>{t("punch:events.note")}</TableHead>
              <TableHead className="text-right">{t("common:table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center">{t("common:common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t("punch:events.empty")}</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id} className={r.status === "voided" ? "text-muted-foreground line-through decoration-1" : ""}>
                <TableCell className="whitespace-nowrap text-xs">{r.punchAt}</TableCell>
                <TableCell className="whitespace-nowrap">{r.employeeName ?? "—"}（{r.employeeId}）</TableCell>
                <TableCell><Badge variant="outline">{t(`punch:types.${r.type}`)}</Badge></TableCell>
                <TableCell className="text-xs">{t(`punch:sources.${r.source}`)}</TableCell>
                <TableCell className="text-xs">{r.deviceLabel ?? "—"}<br /><span className="text-muted-foreground">{r.ip}</span></TableCell>
                <TableCell className="max-w-[260px] text-xs">
                  {flagLabel(r.flags) && <span className="mr-2 text-amber-700">{flagLabel(r.flags)}</span>}
                  {r.note}
                  {r.status === "voided" && <span className="no-underline">{t("punch:events.voidedInfo", { by: r.voidedBy, reason: r.voidReason })}</span>}
                  {r.source === "correction" && r.createdBy && <span>（{r.createdBy}）</span>}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && r.status === "valid" && <Button size="sm" variant="outline" onClick={() => setVoiding(r)}>{t("punch:events.void")}</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("punch:events.prev")}</Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {maxPage + 1}</span>
          <Button size="sm" variant="outline" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>{t("punch:events.next")}</Button>
        </div>
      )}

      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("punch:events.voidTitle")}</DialogTitle>
            <DialogDescription>{voiding && `${voiding.employeeName}（${voiding.employeeId}）· ${voiding.punchAt} · ${t(`punch:types.${voiding.type}`)}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>{t("punch:events.reason")}</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder={t("punch:events.reasonPlaceholder")} />
            <p className="text-xs text-muted-foreground">{t("punch:events.voidHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>{t("common:actions.cancel")}</Button>
            <Button disabled={!voidReason.trim()} onClick={submitVoid}>{t("common:actions.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("punch:events.addCorrection")}</DialogTitle>
            <DialogDescription>{t("punch:events.correctionHint")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCorrection} className="space-y-3">
            <div className="space-y-1"><Label>{t("punch:events.employeeId")}</Label><Input required value={correction.employeeId} onChange={(e) => setCorrection({ ...correction, employeeId: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t("common:table.date")}</Label><Input type="date" required max={todayStr()} value={correction.date} onChange={(e) => setCorrection({ ...correction, date: e.target.value })} /></div>
              <div className="space-y-1"><Label>{t("punch:events.clockTime")}</Label><Input type="time" required value={correction.time} onChange={(e) => setCorrection({ ...correction, time: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>{t("punch:events.type")}</Label>
              <Select value={correction.type} onValueChange={(v) => setCorrection({ ...correction, type: v as PunchType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">{t("punch:types.in")}</SelectItem>
                  <SelectItem value="out">{t("punch:types.out")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t("punch:events.reason")}</Label><Textarea required value={correction.reason} onChange={(e) => setCorrection({ ...correction, reason: e.target.value })} placeholder={t("punch:events.reasonPlaceholder")} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCorrectionOpen(false)}>{t("common:actions.cancel")}</Button>
              <Button type="submit">{t("common:actions.confirm")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsTab;
