import { useTranslation } from "react-i18next";

// 待審核但目前登入者不能審時，用文字說明原因（取代核准／退回按鈕）
const ReviewBlockNote = ({ code }: { code?: string | null }) => {
  const { t } = useTranslation("common");
  if (!code) return null;
  return <span className="text-xs text-muted-foreground">{t(`reviewBlock.${code}`)}</span>;
};

export default ReviewBlockNote;
