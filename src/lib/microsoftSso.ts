// Microsoft 365 單一登入（授權碼 + PKCE，不使用 client secret）。
// 瀏覽器自己產生 code_verifier／state／nonce 存在 sessionStorage，導向 Microsoft 登入；回來後用 code_verifier
// 向 Microsoft 換 id_token（SPA 是公開用戶端，不需要祕密），再把 id_token 交給後端驗證並換成系統登入 token。
// PKCE 需要 crypto.subtle，只有 HTTPS 或 localhost 才有；Entra ID 的 SPA 重新導向 URI 本來也只允許這兩種。

const KEY = "hrms_ms_sso";
const SCOPE = "openid profile email";

export class MicrosoftSsoError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomString = (byteLength = 32) => base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));

export const redirectUri = () => `${window.location.origin}/sso-callback`;

export async function startMicrosoftLogin(tenantId: string, clientId: string): Promise<void> {
  if (!window.isSecureContext || !crypto?.subtle) throw new MicrosoftSsoError("needs_https");

  const verifier = randomString(64);
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = randomString();
  const nonce = randomString();
  sessionStorage.setItem(KEY, JSON.stringify({ verifier, state, nonce, tenantId, clientId }));

  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.location.href = url.toString();
}

const decodePayload = (jwt: string): Record<string, unknown> => {
  const part = jwt.split(".")[1] ?? "";
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
  return JSON.parse(json);
};

// 在 /sso-callback 呼叫：驗證 state、用 code_verifier 向 Microsoft 換 id_token，回傳 id_token 與 nonce 交給後端驗證
export async function finishMicrosoftLogin(search: string): Promise<{ idToken: string; nonce: string }> {
  const params = new URLSearchParams(search);
  const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { verifier: string; state: string; nonce: string; tenantId: string; clientId: string } | null;
  sessionStorage.removeItem(KEY); // 一次性，不管成功失敗都清掉

  if (params.get("error")) throw new MicrosoftSsoError("microsoft_error");
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) throw new MicrosoftSsoError("invalid_state");

  const response = await fetch(`https://login.microsoftonline.com/${saved.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: saved.clientId, grant_type: "authorization_code", code, redirect_uri: redirectUri(),
      code_verifier: saved.verifier, scope: SCOPE,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id_token) throw new MicrosoftSsoError("token_exchange_failed");

  // 先在本地確認 nonce（防止別人把舊的 id_token 塞進來），後端驗證時會再比對一次
  if (decodePayload(data.id_token).nonce !== saved.nonce) throw new MicrosoftSsoError("invalid_state");
  return { idToken: data.id_token, nonce: saved.nonce };
}
