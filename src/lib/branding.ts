// 自訂瀏覽器分頁圖示：後端有上傳圖片就用它，沒有就維持預設的 /favicon.ico。
// 讀取是公開的（登入頁也要顯示），失敗時靜默沿用預設圖示。
const DEFAULT_ICON = "/favicon.ico";

function iconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  return link;
}

export function setFaviconHref(hasFavicon: boolean, version: number) {
  const link = iconLink();
  link.removeAttribute("type"); // 格式由伺服器的 Content-Type 決定
  link.href = hasFavicon ? `/api/branding/favicon?v=${version}` : DEFAULT_ICON;
}

const DEFAULT_TITLE = document.title;

// 空白＝沿用 index.html 的預設標題
export function setSiteTitle(title: string) {
  document.title = title.trim() || DEFAULT_TITLE;
}

export async function applyBranding(): Promise<void> {
  try {
    const response = await fetch("/api/branding");
    if (!response.ok) return;
    const data = (await response.json()) as { hasFavicon: boolean; siteTitle: string; version: number };
    setFaviconHref(data.hasFavicon, data.version);
    setSiteTitle(data.siteTitle ?? "");
  } catch {
    // 沿用預設圖示
  }
}
