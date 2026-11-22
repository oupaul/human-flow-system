import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { punchApi } from "@/services/punchApi";
import { PunchStats } from "@/types/punchStats";
import { toLocalDateStr, todayStr } from "@/lib/taipeiDate";

// 類別色依固定順序指派（已用 validate_palette 驗證前三色在淺色底的分離度）；
// 第三色（青綠）對比度偏低，所以圖例清楚標名並附每週資料表當替代檢視
const COLORS = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a" };
const GRID = "#e5e7eb";
const AXIS = "#6b7280";

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toLocalDateStr(d); };
const monthStart = () => `${todayStr().slice(0, 7)}-01`;

const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="rounded-md border bg-white p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold tabular-nums">{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const StatsTab = () => {
  const { t } = useTranslation(["punch", "common"]);
  const [from, setFrom] = useState(daysAgo(27));
  const [to, setTo] = useState(todayStr());
  const [stats, setStats] = useState<PunchStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setStats(await punchApi.getStats(from, to));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [from, to, t]);

  useEffect(() => { load(); }, [load]);

  const preset = (f: string, e: string) => { setFrom(f); setTo(e); };
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

  const weekly = (stats?.weekly ?? []).map((w) => ({ ...w, label: w.weekStart.slice(5) }));
  const tooltipStyle = { fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" };

  const rejectionLabel = (code: string) => t(`punch:stats.codes.${code}`, { defaultValue: code });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><label className="text-sm font-medium">{t("punch:events.from")}</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><label className="text-sm font-medium">{t("punch:events.to")}</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex gap-2 pb-0.5">
          <Button variant="outline" size="sm" onClick={() => preset(daysAgo(27), todayStr())}>{t("punch:stats.last4Weeks")}</Button>
          <Button variant="outline" size="sm" onClick={() => preset(daysAgo(89), todayStr())}>{t("punch:stats.last3Months")}</Button>
          <Button variant="outline" size="sm" onClick={() => preset(monthStart(), todayStr())}>{t("punch:stats.thisMonth")}</Button>
        </div>
      </div>

      {stats && (
        <p className="text-xs text-muted-foreground">
          {stats.rejectionsSince ? t("punch:stats.sinceNote", { since: stats.rejectionsSince.slice(0, 16) }) : t("punch:stats.noRejectionsYet")}
        </p>
      )}

      {loading && !stats ? <p className="py-8 text-center text-muted-foreground">{t("common:common.loading")}</p> : stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Stat label={t("punch:stats.cards.users")} value={stats.summary.systemEmployees} sub={t("punch:stats.cards.usersSub", { n: stats.summary.punchers })} />
            <Stat label={t("punch:stats.cards.punches")} value={stats.summary.webPunches} />
            <Stat label={t("punch:stats.cards.ipBlocked")} value={stats.summary.ipBlocked} sub={t("punch:stats.cards.rateSub", { rate: pct(stats.summary.ipBlockedRate) })} />
            <Stat label={t("punch:stats.cards.deviceBlocked")} value={stats.summary.deviceBlocked} sub={t("punch:stats.cards.rateSub", { rate: pct(stats.summary.deviceBlockedRate) })} />
            <Stat label={t("punch:stats.cards.exceptions")} value={stats.exceptions.total} sub={t("punch:stats.cards.openSub", { n: stats.exceptions.open })} />
            <Stat label={t("punch:stats.cards.late")} value={pct(stats.summary.lateRate)} sub={t("punch:stats.cards.lateSub", { late: stats.summary.lateDays, total: stats.summary.workedDays })} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("punch:stats.charts.blockedTitle")}</CardTitle>
                <CardDescription>{t("punch:stats.charts.blockedHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => t("punch:stats.weekOf", { date: l })} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="ipBlocked" name={t("punch:stats.series.ipBlocked")} fill={COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="deviceBlocked" name={t("punch:stats.series.deviceBlocked")} fill={COLORS.orange} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("punch:stats.charts.qualityTitle")}</CardTitle>
                <CardDescription>{t("punch:stats.charts.qualityHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => t("punch:stats.weekOf", { date: l })} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="exceptions" name={t("punch:stats.series.exceptions")} fill={COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={18} />
                      <Bar dataKey="correctionRequests" name={t("punch:stats.series.correctionRequests")} fill={COLORS.orange} radius={[4, 4, 0, 0]} maxBarSize={18} />
                      <Bar dataKey="hrCorrections" name={t("punch:stats.series.hrCorrections")} fill={COLORS.aqua} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("punch:stats.weeklyTable")}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("punch:stats.week")}</TableHead>
                      <TableHead className="text-right">{t("punch:stats.cards.punches")}</TableHead>
                      <TableHead className="text-right">{t("punch:stats.series.ipBlocked")}</TableHead>
                      <TableHead className="text-right">{t("punch:stats.series.deviceBlocked")}</TableHead>
                      <TableHead className="text-right">{t("punch:stats.series.exceptions")}</TableHead>
                      <TableHead className="text-right">{t("punch:stats.series.correctionRequests")}</TableHead>
                      <TableHead className="text-right">{t("punch:stats.series.hrCorrections")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.weekly.map((w) => (
                      <TableRow key={w.weekStart}>
                        <TableCell>{w.weekStart}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.webPunches}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.ipBlocked}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.deviceBlocked}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.exceptions}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.correctionRequests}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.hrCorrections}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("punch:stats.byCodeTitle")}</CardTitle><CardDescription>{t("punch:stats.byCodeHint")}</CardDescription></CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("punch:stats.reason")}</TableHead><TableHead className="text-right">{t("punch:stats.count")}</TableHead><TableHead className="text-right">{t("punch:stats.people")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {stats.rejectionsByCode.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{t("punch:stats.none")}</TableCell></TableRow>
                      ) : stats.rejectionsByCode.map((r) => (
                        <TableRow key={r.code}>
                          <TableCell>{rejectionLabel(r.code)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.employees}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("punch:stats.topIpsTitle")}</CardTitle><CardDescription>{t("punch:stats.topIpsHint")}</CardDescription></CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>IP</TableHead><TableHead className="text-right">{t("punch:stats.count")}</TableHead><TableHead className="text-right">{t("punch:stats.people")}</TableHead><TableHead>{t("punch:stats.lastSeen")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {stats.topIps.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">{t("punch:stats.none")}</TableCell></TableRow>
                      ) : stats.topIps.map((r) => (
                        <TableRow key={r.ip ?? "?"}>
                          <TableCell className="font-mono text-xs">{r.ip ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.employees}</TableCell>
                          <TableCell className="text-xs">{r.lastSeen.slice(0, 16)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("punch:stats.topEmployeesTitle")}</CardTitle><CardDescription>{t("punch:stats.topEmployeesHint")}</CardDescription></CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("common:table.name")}</TableHead><TableHead className="text-right">{t("punch:stats.series.ipBlocked")}</TableHead><TableHead className="text-right">{t("punch:stats.series.deviceBlocked")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {stats.topEmployees.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{t("punch:stats.none")}</TableCell></TableRow>
                      ) : stats.topEmployees.map((r) => (
                        <TableRow key={r.employeeId ?? "?"}>
                          <TableCell>{r.name ?? "—"}（{r.employeeId}）<span className="ml-1 text-xs text-muted-foreground">{r.department}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{r.ipBlocked}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.deviceBlocked}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("punch:stats.othersTitle")}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>{t("punch:stats.others.newDevices")}</span><span className="tabular-nums">{stats.devices.newDevices}</span></div>
                <div className="flex justify-between"><span>{t("punch:stats.others.multiDevice")}</span><span className="tabular-nums">{stats.devices.employeesWithMultipleDevices}</span></div>
                <div className="flex justify-between"><span>{t("punch:stats.others.outingPunches")}</span><span className="tabular-nums">{stats.devices.flags.outing ?? 0}</span></div>
                <div className="flex justify-between"><span>{t("punch:stats.others.hrCorrections")}</span><span className="tabular-nums">{stats.summary.hrCorrections}</span></div>
                <div className="flex justify-between"><span>{t("punch:stats.others.voided")}</span><span className="tabular-nums">{stats.summary.voided}</span></div>
                <div className="flex justify-between"><span>{t("punch:stats.others.operational")}</span><span className="tabular-nums">{stats.summary.operationalRejections}</span></div>
                <div className="flex justify-between"><span>{t("punch:stats.others.corrections")}</span><span className="tabular-nums">{stats.requests.corrections.map((r) => `${t(`punch:requests.status.${r.status}`)} ${r.count}`).join(" / ") || "—"}</span></div>
                <div className="flex justify-between"><span>{t("punch:stats.others.outings")}</span><span className="tabular-nums">{stats.requests.outings.map((r) => `${t(`punch:requests.status.${r.status}`)} ${r.count}`).join(" / ") || "—"}</span></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("punch:stats.readTitle")}</CardTitle><CardDescription>{t("punch:stats.readHint")}</CardDescription></CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {(["ip", "device", "quality", "decision"] as const).map((k) => <li key={k}>{t(`punch:stats.read.${k}`)}</li>)}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default StatsTab;
