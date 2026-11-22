import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { History, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AccountAuditDialog from "@/components/AccountAuditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { accountsApi } from "@/services/accountsApi";
import { ACCOUNT_ROLES, Account, AccountRole } from "@/types/accounts";

const Accounts = () => {
  const { t } = useTranslation(["accounts", "common"]);
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pendingRole, setPendingRole] = useState<{ account: Account; role: AccountRole } | null>(null);
  const [pendingActive, setPendingActive] = useState<Account | null>(null);
  const [pendingReset, setPendingReset] = useState<Account | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; password: string; employee: boolean } | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setAccounts(await accountsApi.list());
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (!keyword) return true;
      return [a.username, a.employeeName ?? "", a.employeeId ?? ""].some((v) => v.toLowerCase().includes(keyword));
    });
  }, [accounts, q, roleFilter]);

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      setBusy(true);
      await action();
      toast.success(successMessage);
      await load();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("common:common.operationFailed");
      toast.error(t("accounts:saveFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  };

  const confirmRole = async () => {
    if (!pendingRole) return;
    const { account, role } = pendingRole;
    setPendingRole(null);
    await run(() => accountsApi.update(account.id, { role }), t("accounts:roleUpdated"));
  };

  const confirmActive = async () => {
    if (!pendingActive) return;
    const account = pendingActive;
    setPendingActive(null);
    await run(() => accountsApi.update(account.id, { active: !account.active }), t("accounts:statusUpdated"));
  };

  const confirmReset = async () => {
    if (!pendingReset) return;
    const account = pendingReset;
    setPendingReset(null);
    try {
      setBusy(true);
      const result = await accountsApi.resetPassword(account.id);
      setResetResult({ username: result.username, password: result.temporaryPassword, employee: !!account.employeeId });
      await load();
    } catch (error) {
      toast.error(t("accounts:saveFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("accounts:title")}</h1>
          <p className="text-sm text-muted-foreground">{t("accounts:subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => setAuditOpen(true)}>
          <History className="mr-2 h-4 w-4" />{t("accounts:audit.button")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />{t("accounts:roles.title")}</CardTitle>
          <CardDescription>{t("accounts:roles.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 md:grid-cols-2">
            {ACCOUNT_ROLES.map((r) => (
              <div key={r} className="rounded-md border p-3">
                <dt className="font-medium">{t(`common:role.${r}`)}</dt>
                <dd className="text-sm text-muted-foreground">{t(`accounts:roles.${r}`)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("accounts:list.title")}</CardTitle>
          <CardDescription>{t("accounts:list.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input className="w-64" placeholder={t("accounts:list.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("accounts:list.allRoles")}</SelectItem>
                {ACCOUNT_ROLES.map((r) => <SelectItem key={r} value={r}>{t(`common:role.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{t("accounts:list.count", { count: filtered.length })}</span>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accounts:columns.username")}</TableHead>
                  <TableHead>{t("accounts:columns.employee")}</TableHead>
                  <TableHead>{t("accounts:columns.role")}</TableHead>
                  <TableHead>{t("accounts:columns.status")}</TableHead>
                  <TableHead className="text-right">{t("accounts:columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center">{t("common:common.loading")}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("accounts:list.empty")}</TableCell></TableRow>
                ) : filtered.map((a) => {
                  const isSelf = a.id === user?.id;
                  return (
                    <TableRow key={a.id} className={a.active ? "" : "opacity-60"}>
                      <TableCell className="whitespace-nowrap">
                        {a.username}
                        {isSelf && <Badge variant="secondary" className="ml-2">{t("accounts:you")}</Badge>}
                        {a.mustChangePassword && <Badge variant="outline" className="ml-2">{t("accounts:mustChange")}</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {a.employeeName ? `${a.employeeName}（${a.employeeId}）` : <span className="text-muted-foreground">{t("accounts:noEmployee")}</span>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={a.role}
                          disabled={busy || isSelf}
                          onValueChange={(v) => v !== a.role && setPendingRole({ account: a, role: v as AccountRole })}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_ROLES.map((r) => <SelectItem key={r} value={r}>{t(`common:role.${r}`)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={a.active} disabled={busy || isSelf} onCheckedChange={() => setPendingActive(a)} aria-label={t("accounts:columns.status")} />
                          <span className="text-sm">{a.active ? t("accounts:active") : t("accounts:inactive")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={busy || isSelf} onClick={() => setPendingReset(a)}>
                          <KeyRound className="mr-1 h-3 w-3" />{t("accounts:resetPassword")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{t("accounts:selfHint")}</p>
        </CardContent>
      </Card>

      {/* 變更角色確認 */}
      <AlertDialog open={!!pendingRole} onOpenChange={(open) => !open && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounts:confirmRole.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole && t("accounts:confirmRole.body", {
                username: pendingRole.account.username,
                from: t(`common:role.${pendingRole.account.role}`),
                to: t(`common:role.${pendingRole.role}`),
              })}
              {pendingRole && <span className="mt-2 block">{t(`accounts:roles.${pendingRole.role}`)}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRole}>{t("common:actions.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 停用/啟用確認 */}
      <AlertDialog open={!!pendingActive} onOpenChange={(open) => !open && setPendingActive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingActive?.active ? t("accounts:confirmActive.disableTitle") : t("accounts:confirmActive.enableTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingActive && t(pendingActive.active ? "accounts:confirmActive.disableBody" : "accounts:confirmActive.enableBody", { username: pendingActive.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmActive}>{t("common:actions.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重設密碼確認 */}
      <AlertDialog open={!!pendingReset} onOpenChange={(open) => !open && setPendingReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounts:confirmReset.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingReset && t(pendingReset.employeeId ? "accounts:confirmReset.bodyEmployee" : "accounts:confirmReset.bodyRandom", { username: pendingReset.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>{t("common:actions.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重設結果：臨時密碼只在這裡顯示一次 */}
      <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accounts:resetResult.title")}</DialogTitle>
            <DialogDescription>{t("accounts:resetResult.description")}</DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-2 rounded-md bg-muted p-4 text-sm">
              <div>{t("accounts:resetResult.username")}：<span className="font-mono">{resetResult.username}</span></div>
              <div>{t("accounts:resetResult.password")}：<span className="font-mono text-base font-semibold select-all">{resetResult.password}</span></div>
              <div className="text-xs text-muted-foreground">{resetResult.employee ? t("accounts:resetResult.employeeNote") : t("accounts:resetResult.randomNote")}</div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>{t("common:actions.close", { defaultValue: "OK" })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AccountAuditDialog open={auditOpen} onOpenChange={setAuditOpen} />
    </div>
  );
};

export default Accounts;
