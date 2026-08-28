import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { t, i18n } = useTranslation("common");

  return (
    <Select value={i18n.resolvedLanguage} onValueChange={(value) => i18n.changeLanguage(value)}>
      <SelectTrigger
        aria-label={t("language.label")}
        className={cn("h-9 w-[130px] gap-1 border-none bg-transparent focus:ring-0", className)}
      >
        <Globe className="h-4 w-4 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {t(lang.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSwitcher;
