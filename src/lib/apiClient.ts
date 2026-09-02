const API_BASE_URL = "/api";
const TOKEN_KEY = "hrms_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  // FormData（檔案上傳）不能手動設定 Content-Type，瀏覽器要自己帶正確的
  // multipart boundary，設了反而會讓後端解析失敗
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // 登入本身失敗（帳號或密碼錯誤）不算「登入已過期」，讓下方一般錯誤處理
  // 把後端實際的錯誤訊息（如「帳號或密碼錯誤」）顯示出來，不要覆蓋掉
  if (response.status === 401 && path !== "/auth/login") {
    clearToken();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "登入已過期，請重新登入");
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(response.status, formatApiErrorMessage(errorBody, response.status));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// 後端幾乎每個錯誤都會回 { error, detail }，detail 是實際的底層錯誤訊息
// （如 SMTP 認證失敗的原因、SQL 錯誤等），對排查問題很關鍵，不能只顯示
// 前面那句通用的中文訊息就把它丟掉
function formatApiErrorMessage(errorBody: { error?: string; detail?: string } | null, status: number): string {
  const base = errorBody?.error || `HTTP error! status: ${status}`;
  if (errorBody?.detail) {
    return `${base}：${errorBody.detail}`;
  }
  return base;
}

// 下載二進位檔案（如請假附件）用，apiFetch 的 response.json() 不適用
export async function apiFetchBlob(path: string): Promise<Blob> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(response.status, formatApiErrorMessage(errorBody, response.status));
  }

  return response.blob();
}
