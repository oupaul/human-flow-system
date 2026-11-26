// 密碼登入的暴力破解防護。計數放在記憶體（本系統只有一個後端行程），重啟後歸零。
// 三種計數同時生效，任一達上限就暫時拒絕：
//   同一帳號＋同一 IP：擋住針對單一帳號猜密碼
//   同一帳號（不分 IP）：擋住換 IP 繼續猜
//   同一 IP（不分帳號）：擋住拿預設密碼掃大量帳號
// Microsoft 365 單一登入不經過這裡，帳號被暫時鎖定時仍可使用。

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { pair: 5, user: 20, ip: 30 };
const MAX_BUCKETS = 20000;

const buckets = new Map(); // key -> { count, since, lockedUntil }

const keysFor = (username, ip) => {
  const name = String(username).trim().toLowerCase().slice(0, 100);
  return { pair: `pair:${name}|${ip}`, user: `user:${name}`, ip: `ip:${ip}` };
};

const isStale = (b, now) => b.lockedUntil <= now && now - b.since > WINDOW_MS;

function prune(now) {
  for (const [key, b] of buckets) if (isStale(b, now)) buckets.delete(key);
  // 清完仍過多（短時間被大量不同帳號灌爆）：丟掉最舊的，避免記憶體無限成長
  for (const key of buckets.keys()) {
    if (buckets.size <= MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

// 每次嘗試「驗證密碼之前」呼叫並先計一次，同時送出的大量請求才擋得住。
// 回傳 { blocked, retryAfterSec } 或 { blocked: false, justLocked }
export function beginLoginAttempt(username, ip, now = Date.now()) {
  const keys = keysFor(username, ip);
  const lockedUntil = Math.max(0, ...Object.values(keys).map((k) => buckets.get(k)?.lockedUntil ?? 0));
  if (lockedUntil > now) return { blocked: true, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };

  if (buckets.size > MAX_BUCKETS) prune(now);
  let justLocked = false;
  for (const [kind, key] of Object.entries(keys)) {
    let b = buckets.get(key);
    if (!b || isStale(b, now) || (b.lockedUntil && b.lockedUntil <= now)) {
      b = { count: 0, since: now, lockedUntil: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count >= LIMITS[kind]) {
      b.lockedUntil = now + WINDOW_MS;
      justLocked = true;
    }
  }
  return { blocked: false, justLocked };
}

// 密碼正確：清掉這個帳號的計數；IP 的計數只退回這一次（同一 IP 對其他帳號的失敗仍保留）
export function loginSucceeded(username, ip) {
  const keys = keysFor(username, ip);
  buckets.delete(keys.pair);
  buckets.delete(keys.user);
  const b = buckets.get(keys.ip);
  if (b) {
    b.count = Math.max(0, b.count - 1);
    if (b.count < LIMITS.ip) b.lockedUntil = 0;
  }
}
