import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImageIcon, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiClient";
import { setFaviconHref, setSiteTitle } from "@/lib/branding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Branding { hasFavicon: boolean; siteTitle: string; version: number }

const MAX_BYTES = 256 * 1024;
const MAX_TITLE = 50;

// 外觀設定：自訂瀏覽器分頁圖示。存在資料庫，所有使用者（含登入頁）都會看到
const BrandingCard = () => {
  const { t } = useTranslation(["settings", "common"]);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    apiFetch<Branding>("/branding").then((b) => { setBranding(b); setTitle(b.siteTitle ?? ""); }).catch(() => setBranding({ hasFavicon: false, siteTitle: "", version: 0 }));
  }, []);

  const apply = (next: Branding) => {
    setBranding(next);
    setFaviconHref(next.hasFavicon, next.version);
  };

  const saveTitle = async () => {
    try {
      setBusy(true);
      const next = await apiFetch<Branding>("/branding/title", { method: "PUT", body: JSON.stringify({ title }) });
      setBranding(next);
      setTitle(next.siteTitle ?? "");
      setSiteTitle(next.siteTitle ?? "");
      toast.success(t("settings:branding.titleSaved"));
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(t("settings:branding.tooLarge", { kb: MAX_BYTES / 1024 }));
      return;
    }
    try {
      setBusy(true);
      const form = new FormData();
      form.append("file", file);
      apply(await apiFetch<Branding>("/branding/favicon", { method: "PUT", body: form }));
      toast.success(t("settings:branding.uploaded"));
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    try {
      setBusy(true);
      apply(await apiFetch<Branding>("/branding/favicon", { method: "DELETE" }));
      toast.success(t("settings:branding.resetDone"));
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const src = branding?.hasFavicon ? `/api/branding/favicon?v=${branding.version}` : "/favicon.ico";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />{t("settings:branding.title")}</CardTitle>
        <CardDescription>{t("settings:branding.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-white">
            <img src={src} alt="" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-sm text-muted-foreground">
            {branding?.hasFavicon ? t("settings:branding.custom") : t("settings:branding.default")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept=".png,.ico,.svg,.jpg,.jpeg,.webp,image/*" className="hidden" onChange={onPick} />
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />{t("settings:branding.upload")}</Button>
          {branding?.hasFavicon && <Button variant="ghost" disabled={busy} onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />{t("settings:branding.reset")}</Button>}
        </div>
        <p className="text-xs text-muted-foreground">{t("settings:branding.hint", { kb: MAX_BYTES / 1024 })}</p>

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="siteTitle">{t("settings:branding.titleLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="siteTitle" className="max-w-sm" maxLength={MAX_TITLE} value={title} placeholder={t("settings:branding.titlePlaceholder")} onChange={(e) => setTitle(e.target.value)} />
            <Button disabled={busy || title.trim() === (branding?.siteTitle ?? "")} onClick={saveTitle}>{t("common:actions.save")}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings:branding.titleHint")}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BrandingCard;
