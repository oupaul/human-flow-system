import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { scheduleApi } from "@/services/scheduleApi";
import { ShiftType } from "@/types/schedule";

const empty = { name: "", startTime: "09:00", endTime: "18:00", breakMinutes: "60", active: true };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onChanged: () => void;
}

const ShiftTypesDialog = ({ open, onOpenChange, canEdit, onChanged }: Props) => {
  const { t } = useTranslation(["schedule", "common"]);
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setTypes(await scheduleApi.getShiftTypes());
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  }, [t]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const startEdit = (s: ShiftType) => {
    setEditingId(s.id);
    setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, breakMinutes: String(s.breakMinutes), active: s.active });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name.trim(), startTime: form.startTime, endTime: form.endTime, breakMinutes: Number(form.breakMinutes), active: form.active };
    try {
      if (editingId) await scheduleApi.updateShiftType(editingId, data);
      else await scheduleApi.createShiftType(data);
      toast.success(t("common:common.saveSuccess"));
      setForm(empty);
      setEditingId(null);
      await load();
      onChanged();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const remove = async (s: ShiftType) => {
    try {
      await scheduleApi.deleteShiftType(s.id);
      toast.success(t("common:common.deleteSuccess"));
      await load();
      onChanged();
    } catch (error) {
      toast.error(t("common:common.deleteFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("schedule:shiftTypes.title")}</DialogTitle>
          <DialogDescription>{t("schedule:shiftTypes.description")}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("schedule:shiftTypes.name")}</TableHead>
                <TableHead>{t("schedule:shiftTypes.time")}</TableHead>
                <TableHead>{t("schedule:shiftTypes.break")}</TableHead>
                <TableHead>{t("common:table.status")}</TableHead>
                {canEdit && <TableHead className="text-right">{t("common:table.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">{t("schedule:shiftTypes.empty")}</TableCell></TableRow>
              ) : types.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.startTime} ~ {s.endTime}{s.crossesMidnight && <Badge variant="outline" className="ml-2">{t("schedule:shiftTypes.crosses")}</Badge>}</TableCell>
                  <TableCell>{t("schedule:shiftTypes.minutes", { count: s.breakMinutes })}</TableCell>
                  <TableCell>{s.active ? t("common:common.yes") : t("schedule:shiftTypes.inactive")}</TableCell>
                  {canEdit && (
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => startEdit(s)}>{t("common:actions.edit")}</Button>
                      <Button size="sm" variant="outline" onClick={() => remove(s)}>{t("common:actions.delete")}</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {canEdit && (
          <form onSubmit={save} className="space-y-3 rounded-md border p-4">
            <h4 className="font-semibold">{editingId ? t("schedule:shiftTypes.edit") : t("schedule:shiftTypes.add")}</h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="space-y-1"><Label>{t("schedule:shiftTypes.name")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("schedule:shiftTypes.namePlaceholder")} /></div>
              <div className="space-y-1"><Label>{t("schedule:shiftTypes.start")}</Label><Input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
              <div className="space-y-1"><Label>{t("schedule:shiftTypes.end")}</Label><Input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
              <div className="space-y-1"><Label>{t("schedule:shiftTypes.break")}</Label><Input type="number" min={0} max={240} value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>{t("schedule:shiftTypes.activeLabel")}</Label></div>
            <p className="text-xs text-muted-foreground">{t("schedule:shiftTypes.crossHint")}</p>
            <div className="flex gap-2">
              <Button type="submit">{t("common:actions.save")}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>{t("common:actions.cancel")}</Button>}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShiftTypesDialog;
