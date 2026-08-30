import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Loader2, Paperclip, Plus, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import { useOvertimeApplications } from "@/hooks/useOvertimeApplications";
import { useLeaveGrants } from "@/hooks/useLeaveGrants";
import { LeaveApplicationFormData } from "@/types/leave";
import { OvertimeApplicationFormData } from "@/types/overtime";
import { leaveApi } from "@/services/leaveApi";

const getStatusDisplay = (status: string, t: (key: string) => string) => {
  switch (status) {
    case "approved":
      return (
        <span className="flex items-center text-green-600">
          <CheckCircle2 className="mr-1 h-4 w-4" /> {t("common:status.approved")}
        </span>
      );
    case "rejected":
      return (
        <span className="flex items-center text-red-600">
          <XCircle className="mr-1 h-4 w-4" /> {t("common:status.rejected")}
        </span>
      );
    default:
      return <span className="text-yellow-600">{t("common:status.pending")}</span>;
  }
};

const currentYear = new Date().getFullYear();
const RECORD_YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const MyPortal = () => {
  const { t } = useTranslation(["myPortal", "common"]);
  const { user } = useAuth();
  const [leaveHistoryYear, setLeaveHistoryYear] = useState(currentYear);
  const [overtimeHistoryYear, setOvertimeHistoryYear] = useState(currentYear);
  const { leaveTypes, leaveApplications, leaveBalances, loading: loadingLeave, createLeaveApplication } =
    useLeaveManagement(leaveHistoryYear);
  const { overtimeApplications, loading: loadingOvertime, createOvertimeApplication } =
    useOvertimeApplications(overtimeHistoryYear);
  const { leaveGrants } = useLeaveGrants();

  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveApplicationFormData>>({ unit: "day" });
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null);
  const selectedLeaveTypeInfo = leaveTypes.find((t) => t.id.toString() === selectedLeaveType);
  const selectedLeaveTypeNeedsProof = selectedLeaveTypeInfo?.needProof;
  const selectedLeaveTypeIsComp = selectedLeaveTypeInfo?.code === "COMP";

  // 生理假僅限女性員工可選；未填寫性別時不過濾，避免資料不完整時誤擋
  const availableLeaveTypesForApplication = leaveTypes.filter(
    (t) => t.code !== "MSL" || user?.gender !== "male"
  );

  const [isOvertimeDialogOpen, setIsOvertimeDialogOpen] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState<Partial<OvertimeApplicationFormData>>({ compensationType: "pay" });

  const balance = leaveBalances[0];

  const handleSubmitLeave = async () => {
    if (!user?.employeeId || !leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.reason) {
      return;
    }
    if (selectedLeaveTypeIsComp) {
      if (!leaveForm.startTime || !leaveForm.endTime) return;
    } else if (!leaveForm.endDate) {
      return;
    }
    const payload = selectedLeaveTypeIsComp ? { ...leaveForm, endDate: leaveForm.startDate } : leaveForm;
    await createLeaveApplication({ ...payload, employeeId: user.employeeId } as LeaveApplicationFormData, leaveAttachment || undefined);
    setIsLeaveDialogOpen(false);
    setLeaveForm({ unit: "day" });
    setSelectedLeaveType("");
    setLeaveAttachment(null);
  };

  const handleViewAttachment = async (applicationId: number) => {
    try {
      const blob = await leaveApi.downloadLeaveAttachment(applicationId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Failed to view attachment:", error);
    }
  };

  const handleSubmitOvertime = async () => {
    if (!user?.employeeId || !overtimeForm.date || !overtimeForm.startTime || !overtimeForm.endTime || !overtimeForm.reason) {
      return;
    }
    await createOvertimeApplication({ ...overtimeForm, employeeId: user.employeeId } as OvertimeApplicationFormData);
    setIsOvertimeDialogOpen(false);
    setOvertimeForm({ compensationType: "pay" });
  };

  if (loadingLeave || loadingOvertime) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("common:common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("myPortal:welcome", { name: user?.employeeName || user?.username })}
        </h1>
        <div className="flex gap-2">
          <Dialog open={isOvertimeDialogOpen} onOpenChange={setIsOvertimeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Clock className="mr-2 h-4 w-4" /> {t("myPortal:overtimeDialog.trigger")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t("myPortal:overtimeDialog.title")}</DialogTitle>
                <DialogDescription>{t("myPortal:overtimeDialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="overtimeDate">{t("myPortal:overtimeDialog.dateLabel")}</Label>
                  <Input
                    id="overtimeDate"
                    type="date"
                    value={overtimeForm.date || ""}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="overtimeStart">{t("myPortal:startTimeLabel")}</Label>
                    <Input
                      id="overtimeStart"
                      type="time"
                      value={overtimeForm.startTime || ""}
                      onChange={(e) => setOvertimeForm({ ...overtimeForm, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overtimeEnd">{t("myPortal:endTimeLabel")}</Label>
                    <Input
                      id="overtimeEnd"
                      type="time"
                      value={overtimeForm.endTime || ""}
                      onChange={(e) => setOvertimeForm({ ...overtimeForm, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("myPortal:lunchBreakHint")}</p>
                <div className="space-y-2">
                  <Label htmlFor="overtimeReason">{t("myPortal:overtimeDialog.reasonLabel")}</Label>
                  <Textarea
                    id="overtimeReason"
                    rows={3}
                    value={overtimeForm.reason || ""}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtimeCompensationType">{t("myPortal:compensationTypeLabel")}</Label>
                  <Select
                    value={overtimeForm.compensationType || "pay"}
                    onValueChange={(value: "pay" | "comp") => setOvertimeForm({ ...overtimeForm, compensationType: value })}
                  >
                    <SelectTrigger id="overtimeCompensationType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pay">{t("myPortal:overtimeDialog.payOption")}</SelectItem>
                      <SelectItem value="comp">{t("myPortal:overtimeDialog.compOption")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {overtimeForm.compensationType === "comp" && (
                    <p className="text-xs text-muted-foreground">
                      {t("myPortal:overtimeDialog.compHint")}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOvertimeDialogOpen(false)}>
                  {t("common:actions.cancel")}
                </Button>
                <Button onClick={handleSubmitOvertime}>{t("common:actions.submit")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-hrms-accent">
                <Plus className="mr-2 h-4 w-4" /> {t("myPortal:leaveDialog.trigger")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t("myPortal:leaveDialog.title")}</DialogTitle>
                <DialogDescription>{t("myPortal:leaveDialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="leaveType">{t("myPortal:leaveTypeLabel")}</Label>
                  <Select
                    value={selectedLeaveType}
                    onValueChange={(value) => {
                      setSelectedLeaveType(value);
                      setLeaveForm({ ...leaveForm, leaveTypeId: parseInt(value) });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("myPortal:leaveDialog.leaveTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLeaveTypesForApplication.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedLeaveTypeIsComp ? (
                  <>
                    {balance && (
                      <p className="text-sm text-muted-foreground">
                        {t("myPortal:leaveDialog.compBalance", { hours: (balance.compensatoryLeave - balance.compensatoryLeaveUsed).toFixed(1) })}
                        {balance.compensatoryLeaveDeadline && t("myPortal:leaveDialog.compBalanceDeadline", { date: balance.compensatoryLeaveDeadline })}
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="compDate">{t("myPortal:leaveDialog.compDateLabel")}</Label>
                      <Input
                        id="compDate"
                        type="date"
                        value={leaveForm.startDate || ""}
                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value, endDate: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="compStartTime">{t("myPortal:startTimeLabel")}</Label>
                        <Input
                          id="compStartTime"
                          type="time"
                          value={leaveForm.startTime || ""}
                          onChange={(e) => setLeaveForm({ ...leaveForm, startTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compEndTime">{t("myPortal:endTimeLabel")}</Label>
                        <Input
                          id="compEndTime"
                          type="time"
                          value={leaveForm.endTime || ""}
                          onChange={(e) => setLeaveForm({ ...leaveForm, endTime: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("myPortal:lunchBreakHint")}</p>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">{t("myPortal:leaveDialog.startDateLabel")}</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={leaveForm.startDate || ""}
                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">{t("myPortal:leaveDialog.endDateLabel")}</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={leaveForm.endDate || ""}
                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reason">{t("myPortal:leaveDialog.reasonLabel")}</Label>
                  <Textarea
                    id="reason"
                    rows={3}
                    value={leaveForm.reason || ""}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deputy">{t("myPortal:leaveDialog.deputyLabel")}</Label>
                  <Input
                    id="deputy"
                    value={leaveForm.deputy || ""}
                    onChange={(e) => setLeaveForm({ ...leaveForm, deputy: e.target.value })}
                  />
                </div>
                {selectedLeaveTypeNeedsProof && (
                  <div className="space-y-2">
                    <Label htmlFor="leaveAttachment">{t("myPortal:leaveDialog.attachmentLabel")}</Label>
                    <Input
                      id="leaveAttachment"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => setLeaveAttachment(e.target.files?.[0] || null)}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>
                  {t("common:actions.cancel")}
                </Button>
                <Button onClick={handleSubmitLeave}>{t("common:actions.submit")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {balance && (
        <Card>
          <CardHeader>
            <CardTitle>{t("myPortal:balanceCard.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">{t("myPortal:balanceCard.annualLeave")}</p>
              <p className="text-xl font-bold">
                {balance.annualLeave - balance.annualLeaveUsed} / {balance.annualLeave}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("myPortal:balanceCard.sickLeave")}</p>
              <p className="text-xl font-bold">
                {balance.sickLeave - balance.sickLeaveUsed} / {balance.sickLeave}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("myPortal:balanceCard.compensatoryLeave")}</p>
              <p className="text-xl font-bold">
                {balance.compensatoryLeave - balance.compensatoryLeaveUsed} / {balance.compensatoryLeave}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {leaveGrants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("myPortal:grantsTable.title")}</CardTitle>
            <CardDescription>{t("myPortal:grantsTable.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("myPortal:leaveTypeLabel")}</TableHead>
                    <TableHead>{t("myPortal:grantsTable.granted")}</TableHead>
                    <TableHead>{t("myPortal:grantsTable.used")}</TableHead>
                    <TableHead>{t("myPortal:grantsTable.remaining")}</TableHead>
                    <TableHead>{t("myPortal:grantsTable.deadline")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveGrants.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell>{grant.leaveTypeName}</TableCell>
                      <TableCell>{grant.totalDays}</TableCell>
                      <TableCell>{grant.usedDays}</TableCell>
                      <TableCell>{grant.totalDays - grant.usedDays}</TableCell>
                      <TableCell>{grant.deadline || t("myPortal:grantsTable.noDeadline")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("myPortal:leaveHistory.title")}</CardTitle>
              <CardDescription>{t("myPortal:leaveHistory.description")}</CardDescription>
            </div>
            <Select value={String(leaveHistoryYear)} onValueChange={(value) => setLeaveHistoryYear(Number(value))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("myPortal:leaveTypeLabel")}</TableHead>
                  <TableHead>{t("common:table.startDate")}</TableHead>
                  <TableHead>{t("common:table.endDate")}</TableHead>
                  <TableHead>{t("common:table.days")}</TableHead>
                  <TableHead>{t("common:table.status")}</TableHead>
                  <TableHead>{t("myPortal:leaveHistory.attachmentColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveApplications.length > 0 ? (
                  leaveApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>{application.type}</TableCell>
                      <TableCell>{application.startDate}</TableCell>
                      <TableCell>{application.endDate}</TableCell>
                      <TableCell>{application.days}{application.type === '補休' ? t("myPortal:leaveHistory.hoursUnit") : t("myPortal:leaveHistory.daysUnit")}</TableCell>
                      <TableCell>
                        {getStatusDisplay(application.status, t)}
                        {application.reviewNote && (
                          <p className="mt-1 text-xs text-muted-foreground">{t("myPortal:reviewNotePrefix", { note: application.reviewNote })}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {application.attachment ? (
                          <Button variant="ghost" size="icon" onClick={() => handleViewAttachment(application.id)} title={t("myPortal:leaveHistory.viewAttachment")}>
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">{t("common:common.none")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t("myPortal:leaveHistory.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("myPortal:overtimeHistory.title")}</CardTitle>
              <CardDescription>{t("myPortal:overtimeHistory.description")}</CardDescription>
            </div>
            <Select value={String(overtimeHistoryYear)} onValueChange={(value) => setOvertimeHistoryYear(Number(value))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:table.date")}</TableHead>
                  <TableHead>{t("myPortal:overtimeHistory.period")}</TableHead>
                  <TableHead>{t("myPortal:overtimeHistory.hoursColumn")}</TableHead>
                  <TableHead>{t("myPortal:compensationTypeLabel")}</TableHead>
                  <TableHead>{t("common:table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeApplications.length > 0 ? (
                  overtimeApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>{application.date}</TableCell>
                      <TableCell>
                        {application.startTime} - {application.endTime}
                      </TableCell>
                      <TableCell>{application.hours}</TableCell>
                      <TableCell>
                        {application.compensationType === "comp"
                          ? application.compHours
                            ? t("myPortal:overtimeHistory.compWithHours", { hours: application.compHours })
                            : t("myPortal:overtimeHistory.compNoHours")
                          : t("myPortal:overtimeHistory.payOption")}
                      </TableCell>
                      <TableCell>
                        {getStatusDisplay(application.status, t)}
                        {application.reviewNote && (
                          <p className="mt-1 text-xs text-muted-foreground">{t("myPortal:reviewNotePrefix", { note: application.reviewNote })}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {t("myPortal:overtimeHistory.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPortal;
