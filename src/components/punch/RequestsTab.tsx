import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ReviewBlockNote from "@/components/ReviewBlockNote";
import { punchRequestApi } from "@/services/punchRequestApi";
import { CorrectionRequest, OutingRequest, RequestStatus } from "@/types/punchRequests";

type Target = { kind: "correction"; item: CorrectionRequest } | { kind: "outing"; item: OutingRequest };

// 補卡申請與公出申請的審核（主管、HR）。核准補卡會自動補登一筆打卡；退回需填原因
const RequestsTab = () => {
  const { t } = useTranslation(["punch", "common"]);
  const [status, setStatus] = useState<RequestStatus | "all">("pending");
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [outings, setOutings] = useState<OutingRequest[]>([]);
  const [rejecting, setRejecting] = useState<Target | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const s = status === "all" ? undefined : status;
      const [c, o] = await Promise.all([punchRequestApi.listCorrections({ all: true, status: s }), punchRequestApi.listOutings({ all: true, status: s })]);
      setCorrections(c);
      setOutings(o);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  }, [status, t]);

  useEffect(() => { load(); }, [load]);

  const review = async (target: Target, action: "approve" | "reject", reviewNote?: string) => {
    try {
      const result = target.kind === "correction"
        ? await punchRequestApi.reviewCorrection(target.item.id, action, reviewNote)
        : await punchRequestApi.reviewOuting(target.item.id, action, reviewNote);
      toast.success(result.message);
      setRejecting(null);
      setNote("");
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined, duration: 8000 });
    }
  };

  const statusBadge = (s: RequestStatus) => <Badge variant={s === "pending" ? "default" : s === "approved" ? "secondary" : "outline"}>{t(`punch:requests.status.${s}`)}</Badge>;
  const actions = (target: Target, s: RequestStatus) => s === "pending" && (
    target.item.reviewable === false ? <div className="text-right"><ReviewBlockNote code={target.item.reviewBlock} /></div> :
    <div className="space-x-2 text-right">
      <Button size="sm" onClick={() => review(target, "approve")}>{t("punch:requests.approve")}</Button>
      <Button size="sm" variant="outline" onClick={() => setRejecting(target)}>{t("punch:requests.reject")}</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{t("punch:requests.status.pending")}</SelectItem>
            <SelectItem value="approved">{t("punch:requests.status.approved")}</SelectItem>
            <SelectItem value="rejected">{t("punch:requests.status.rejected")}</SelectItem>
            <SelectItem value="all">{t("punch:events.statusAll")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("punch:requests.correctionTitle")}</CardTitle><CardDescription>{t("punch:requests.correctionHint")}</CardDescription></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:table.name")}</TableHead>
                  <TableHead>{t("common:table.date")}</TableHead>
                  <TableHead>{t("punch:events.type")}</TableHead>
                  <TableHead>{t("punch:events.clockTime")}</TableHead>
                  <TableHead>{t("punch:events.reason")}</TableHead>
                  <TableHead>{t("common:table.status")}</TableHead>
                  <TableHead className="text-right">{t("common:table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corrections.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">{t("punch:requests.empty")}</TableCell></TableRow>
                ) : corrections.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.employeeName}（{r.employeeId}）</TableCell>
                    <TableCell>{r.workDate}</TableCell>
                    <TableCell>{t(`punch:types.${r.type}`)}</TableCell>
                    <TableCell>{r.requestedTime}</TableCell>
                    <TableCell className="max-w-[240px] text-xs">{r.reason}{r.reviewNote && <span className="block text-muted-foreground">{t("punch:requests.reviewNote")}：{r.reviewNote}</span>}</TableCell>
                    <TableCell>{statusBadge(r.status)}{r.reviewer && <span className="ml-1 text-xs text-muted-foreground">{r.reviewer}</span>}</TableCell>
                    <TableCell>{actions({ kind: "correction", item: r }, r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("punch:requests.outingTitle")}</CardTitle><CardDescription>{t("punch:requests.outingHint")}</CardDescription></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:table.name")}</TableHead>
                  <TableHead>{t("punch:requests.period")}</TableHead>
                  <TableHead>{t("punch:requests.destination")}</TableHead>
                  <TableHead>{t("common:table.status")}</TableHead>
                  <TableHead className="text-right">{t("common:table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outings.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">{t("punch:requests.empty")}</TableCell></TableRow>
                ) : outings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.employeeName}（{r.employeeId}）</TableCell>
                    <TableCell className="whitespace-nowrap">{r.startDate}{r.endDate !== r.startDate ? ` ~ ${r.endDate}` : ""}</TableCell>
                    <TableCell className="max-w-[240px] text-xs">{r.destination}{r.reason && <span className="block text-muted-foreground">{r.reason}</span>}{r.reviewNote && <span className="block text-muted-foreground">{t("punch:requests.reviewNote")}：{r.reviewNote}</span>}</TableCell>
                    <TableCell>{statusBadge(r.status)}{r.reviewer && <span className="ml-1 text-xs text-muted-foreground">{r.reviewer}</span>}</TableCell>
                    <TableCell>{actions({ kind: "outing", item: r }, r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("punch:requests.rejectTitle")}</DialogTitle>
            <DialogDescription>{rejecting && `${rejecting.item.employeeName}（${rejecting.item.employeeId}）`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>{t("punch:requests.rejectReason")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>{t("common:actions.cancel")}</Button>
            <Button disabled={!note.trim()} onClick={() => rejecting && review(rejecting, "reject", note)}>{t("common:actions.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestsTab;
