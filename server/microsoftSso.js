// Microsoft 365（Entra ID）單一登入：不使用 client secret。
//   * 在 Entra ID 把應用程式註冊成「單頁應用程式（SPA）」，用「授權碼 + PKCE」登入；
//     瀏覽器自己用 code_verifier 去 Microsoft 換 token（SPA 本來就是公開用戶端，沒有祕密），
//     再把拿到的 id_token 交給後端。
//   * 後端不信任前端說了什麼，只信任「Microsoft 簽發的 id_token」：用 Microsoft 公開的 JWKS 驗證簽章，
//     並檢查 issuer（綁定貴公司租戶）、audience（本應用程式）、有效期限與 nonce。
//   * 整個流程沒有任何需要放在 .env 的祕密，只需要租戶 ID 與應用程式（用戶端）ID，這兩個本來就是公開識別碼。

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache = { uri: null, keys: null, fetchedAt: 0 };

export function microsoftConfig(env = process.env) {
  const tenantId = (env.MS_TENANT_ID || '').trim();
  const clientId = (env.MS_CLIENT_ID || '').trim();
  return {
    enabled: Boolean(tenantId && clientId),
    tenantId,
    clientId,
    // 測試用覆寫；預設使用 Microsoft 的公開金鑰端點
    jwksUri: env.MS_JWKS_URI || `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  };
}

async function getKeys(jwksUri, { forceRefresh = false } = {}) {
  const fresh = jwksCache.uri === jwksUri && jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh && !forceRefresh) return jwksCache.keys;
  const response = await fetch(jwksUri, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`取得 Microsoft 公開金鑰失敗（HTTP ${response.status}）`);
  const body = await response.json();
  jwksCache = { uri: jwksUri, keys: body.keys || [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

export class SsoError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 對應前端登入頁的錯誤代碼
  }
}

// 驗證 id_token，成功回傳 claims；失敗丟 SsoError。nonce 需與前端登入時產生並存起來的值一致
export async function verifyIdToken(idToken, nonce, config = microsoftConfig()) {
  if (!config.enabled) throw new SsoError('not_configured', '尚未設定 Microsoft 365 單一登入');
  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) throw new SsoError('token_exchange_failed', 'id_token 格式不正確');

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid || decoded.header.alg !== 'RS256') throw new SsoError('token_exchange_failed', 'id_token 標頭不正確');

  // 找不到金鑰時重抓一次（Microsoft 會輪替簽章金鑰）
  let keys = await getKeys(config.jwksUri);
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    keys = await getKeys(config.jwksUri, { forceRefresh: true });
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new SsoError('token_exchange_failed', '找不到對應的簽章金鑰');

  let claims;
  try {
    claims = jwt.verify(idToken, crypto.createPublicKey({ key: jwk, format: 'jwk' }), {
      algorithms: ['RS256'],
      audience: config.clientId,
      // 租戶專屬的 issuer：只有貴公司租戶簽發的 token 會通過
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
    });
  } catch (error) {
    throw new SsoError(error.name === 'TokenExpiredError' ? 'invalid_state' : 'token_exchange_failed', `id_token 驗證失敗：${error.message}`);
  }
  if (claims.tid && claims.tid !== config.tenantId) throw new SsoError('token_exchange_failed', '租戶不符');
  if (!nonce || claims.nonce !== nonce) throw new SsoError('invalid_state', 'nonce 不符');
  return claims;
}

// 從 claims 取出登入信箱（小寫）：優先用 email，沒有就用 preferred_username（M365 工作帳號為 UPN，通常就是信箱）
export function emailFromClaims(claims) {
  return String(claims.email || claims.preferred_username || '').trim().toLowerCase();
}
