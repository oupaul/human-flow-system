#!/bin/sh
# 一鍵部署：git clone 之後直接執行這支腳本即可，不需要事先裝好任何東西、也不需要手動編輯 .env。
#
#   git clone <repo>
#   cd human-flow-system
#   ./deploy.sh
#
# 腳本會先「檢查環境」，缺什麼就自動補上，最後一路部署到服務可以使用：
#   1. 作業系統與權限（需要 root 或 sudo 才能安裝套件）
#   2. Docker 與 Docker Compose：沒裝就用 Docker 官方安裝腳本自動安裝（Ubuntu／Debian／CentOS／RHEL／Fedora…）
#   3. Docker 服務有沒有在跑、目前帳號有沒有權限（沒權限就自動改用 sudo）
#   4. 磁碟空間與記憶體
#   5. 對外埠（預設 8080）與資料庫埠（預設 3306，只綁 127.0.0.1）有沒有被佔用，被佔用就自動換一個
#   6. .env：不存在就複製 .env.example 並產生隨機的資料庫密碼與 JWT 密鑰（已存在的絕不覆蓋）
#   7. 防火牆（ufw／firewalld 啟用中才處理）：自動放行對外埠
#   8. docker compose up --build -d，並等到服務真的可以用（health check）才結束
#   9. 印出網址與初始管理員帳號密碼（只有第一次啟動會有）
#
# 只想檢查、不做任何變更：./deploy.sh --check
# 不想動防火牆：SKIP_FIREWALL=1 ./deploy.sh
# 忘記管理員密碼／沒看到初始密碼：./deploy.sh --reset-admin（產生新的隨機密碼並顯示）
set -eu
cd "$(dirname "$0")"

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

# ---------- 重設管理員密碼（不需要在主機安裝 Node）----------
if [ "${1:-}" = "--reset-admin" ]; then
  D="docker"
  docker info >/dev/null 2>&1 || D="sudo docker"
  NEWPW="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)"
  if $D compose run --rm -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD="$NEWPW" backend node seed-admin.js >/dev/null 2>&1; then
    printf '\n✅ 管理員密碼已重設（請登入後到「個人設定」修改）\n   帳號：admin\n   密碼：%s\n\n' "$NEWPW"
    exit 0
  fi
  printf '❌ 重設失敗：請確認服務已啟動（先執行 ./deploy.sh）\n' >&2
  exit 1
fi

# ---------- 輸出 ----------
ok()   { printf '  [OK]    %s\n' "$*"; }
fix()  { printf '  [補上]  %s\n' "$*"; }
warn() { printf '  [注意]  %s\n' "$*"; }
bad()  { printf '  [失敗]  %s\n' "$*" >&2; }
step() { printf '\n▶ %s\n' "$*"; }
die()  { bad "$*"; exit 1; }

# 檢查模式下「需要補上的事」只回報、不執行
NEEDS_FIX=0
need_fix() {
  NEEDS_FIX=1
  printf '  [缺少]  %s（部署時會自動補上）\n' "$*"
}

# ---------- 1. 作業系統與權限 ----------
step "1/8 檢查作業系統與權限"
OS="$(uname -s)"
DISTRO=""
if [ "$OS" = "Linux" ] && [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO="${ID:-}"
fi
ok "作業系統：$OS ${DISTRO:+($DISTRO ${VERSION_ID:-})}"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
    ok "使用 sudo 取得安裝與管理權限（可能會要求輸入密碼）"
  else
    warn "不是 root 也沒有 sudo；若需要安裝套件或修改防火牆會失敗"
  fi
else
  ok "目前是 root"
fi

# ---------- 2. Docker 與 Compose ----------
step "2/8 檢查 Docker 與 Docker Compose"

install_docker_linux() {
  case "$DISTRO" in
    ubuntu|debian|raspbian|centos|rhel|fedora|rocky|almalinux|sles) ;;
    *) die "不支援自動安裝 Docker 的系統（${DISTRO}）。請依 https://docs.docker.com/engine/install/ 手動安裝後再執行" ;;
  esac
  [ "$(id -u)" -eq 0 ] || [ -n "$SUDO" ] || die "需要 root 或 sudo 才能安裝 Docker，請改用 root 執行，或先安裝 sudo"
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    fix "安裝 curl"
    case "$DISTRO" in
      ubuntu|debian|raspbian) $SUDO apt-get update -qq && $SUDO apt-get install -y -qq curl ca-certificates ;;
      *) $SUDO sh -c 'command -v dnf >/dev/null 2>&1 && dnf install -y curl || yum install -y curl' ;;
    esac
  fi
  fix "使用 Docker 官方安裝腳本安裝 Docker Engine 與 Compose（約需數分鐘）"
  TMP_INSTALLER="$(mktemp)"
  if command -v curl >/dev/null 2>&1; then curl -fsSL https://get.docker.com -o "$TMP_INSTALLER"; else wget -qO "$TMP_INSTALLER" https://get.docker.com; fi
  $SUDO sh "$TMP_INSTALLER"
  rm -f "$TMP_INSTALLER"
}

DOCKER="docker"
if command -v docker >/dev/null 2>&1; then
  ok "已安裝 Docker：$(docker --version 2>/dev/null | head -n 1)"
else
  case "$OS" in
    Linux)
      if [ "$CHECK_ONLY" -eq 1 ]; then need_fix "尚未安裝 Docker"; else install_docker_linux; fi ;;
    Darwin)
      die "macOS 請先安裝 Docker Desktop（https://www.docker.com/products/docker-desktop/）或 OrbStack（https://orbstack.dev），啟動後再執行這支腳本" ;;
    *)
      die "不支援的作業系統（${OS}）。請手動安裝 Docker 後再執行" ;;
  esac
fi

# 以下檢查需要 docker 指令；檢查模式下 Docker 還沒裝就到此為止
if command -v docker >/dev/null 2>&1; then
  # Docker 服務有沒有在跑
  if ! $DOCKER info >/dev/null 2>&1 && ! ${SUDO:+$SUDO }docker info >/dev/null 2>&1; then
    if [ "$CHECK_ONLY" -eq 1 ]; then
      need_fix "Docker 服務沒有在執行"
    elif [ "$OS" = "Linux" ]; then
      fix "啟動 Docker 服務"
      if command -v systemctl >/dev/null 2>&1; then $SUDO systemctl enable --now docker >/dev/null 2>&1 || true; else $SUDO service docker start >/dev/null 2>&1 || true; fi
      i=0
      while [ "$i" -lt 30 ]; do
        if $DOCKER info >/dev/null 2>&1 || ${SUDO:+$SUDO }docker info >/dev/null 2>&1; then break; fi
        i=$((i + 1)); sleep 1
      done
    else
      die "Docker 沒有在執行，請先啟動 Docker Desktop／OrbStack"
    fi
  fi

  # 目前帳號沒有權限就改用 sudo，並把帳號加進 docker 群組（下次登入後就不用 sudo）
  if $DOCKER info >/dev/null 2>&1; then
    ok "Docker 服務運作中，且目前帳號有權限使用"
  elif [ -n "$SUDO" ] && $SUDO docker info >/dev/null 2>&1; then
    DOCKER="$SUDO docker"
    if [ "$CHECK_ONLY" -eq 1 ]; then
      need_fix "目前帳號沒有 Docker 權限（會改用 sudo，並把帳號加入 docker 群組）"
    else
      fix "目前帳號沒有 Docker 權限，這次改用 sudo 執行，並把 $(id -un) 加入 docker 群組（下次登入後生效）"
      $SUDO usermod -aG docker "$(id -un)" 2>/dev/null || true
    fi
  elif [ "$CHECK_ONLY" -ne 1 ]; then
    die "無法連線到 Docker 服務，請確認 Docker 是否正常運作（systemctl status docker）"
  fi

  # Compose v2（docker compose）
  if $DOCKER compose version >/dev/null 2>&1; then
    ok "Docker Compose：$($DOCKER compose version --short 2>/dev/null || echo v2)"
  elif [ "$CHECK_ONLY" -eq 1 ]; then
    need_fix "缺少 Docker Compose 外掛"
  else
    fix "安裝 Docker Compose 外掛"
    case "$DISTRO" in
      ubuntu|debian|raspbian) $SUDO apt-get update -qq; $SUDO apt-get install -y -qq docker-compose-plugin || $SUDO apt-get install -y -qq docker-compose-v2 ;;
      centos|rhel|fedora|rocky|almalinux) $SUDO sh -c 'dnf install -y docker-compose-plugin || yum install -y docker-compose-plugin' ;;
      *) die "請依 https://docs.docker.com/compose/install/linux/ 安裝 Compose 外掛" ;;
    esac
    $DOCKER compose version >/dev/null 2>&1 || die "Docker Compose 安裝後仍無法使用"
    ok "Docker Compose 已安裝"
  fi
fi

# ---------- 3. 硬體資源 ----------
step "3/8 檢查磁碟空間與記憶體"
FREE_KB="$(df -Pk . 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "${FREE_KB:-}" ]; then
  FREE_GB=$((FREE_KB / 1024 / 1024))
  if [ "$FREE_KB" -lt 2097152 ]; then die "磁碟剩餘空間只有約 ${FREE_GB} GB，建置映像檔至少需要 2 GB"; fi
  if [ "$FREE_KB" -lt 5242880 ]; then warn "磁碟剩餘約 ${FREE_GB} GB，建議至少 5 GB"; else ok "磁碟剩餘約 ${FREE_GB} GB"; fi
fi
if [ -r /proc/meminfo ]; then
  MEM_MB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1024 ))
  if [ "$MEM_MB" -lt 1500 ]; then warn "記憶體只有約 ${MEM_MB} MB，建置前端時可能不足，建議至少 2 GB（可加 swap）"; else ok "記憶體約 ${MEM_MB} MB"; fi
fi

# ---------- 4. 埠 ----------
step "4/8 檢查對外埠"
# 讀 .env 裡指定的值（若有）
env_get() { [ -f .env ] && grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }
env_set() {
  # 有就取代、沒有就新增（相容 macOS 與 Linux 的 sed）
  if grep -qE "^$1=" .env 2>/dev/null; then
    sed "s|^$1=.*|$1=$2|" .env > .env.tmp && mv .env.tmp .env
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

port_in_use() {
  if command -v ss >/dev/null 2>&1; then ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1$"
  elif command -v lsof >/dev/null 2>&1; then lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1$"
  else return 1; fi
}

# 本專案自己已經在用的埠不算被佔用（重複執行 deploy.sh 時會遇到）
OWN_RUNNING=0
if command -v docker >/dev/null 2>&1 && [ -n "$($DOCKER compose ps -q frontend 2>/dev/null || true)" ]; then OWN_RUNNING=1; fi

pick_port() { # $1=名稱 $2=預設 → 輸出可用的埠
  want="$(env_get "$1")"; want="${want:-$2}"
  if [ "$OWN_RUNNING" -eq 1 ] || ! port_in_use "$want"; then echo "$want"; return; fi
  p=$((want + 1)); n=0
  while [ "$n" -lt 50 ]; do
    if ! port_in_use "$p"; then echo "$p"; return; fi
    p=$((p + 1)); n=$((n + 1))
  done
  die "找不到可用的埠（$want 起往後 50 個都被佔用）"
}

FRONTEND_PORT="$(pick_port FRONTEND_PORT 8080)"
DB_HOST_PORT="$(pick_port DB_HOST_PORT 3306)"
WANT_F="$(env_get FRONTEND_PORT)"; WANT_D="$(env_get DB_HOST_PORT)"
if [ "$FRONTEND_PORT" = "${WANT_F:-8080}" ]; then ok "網頁對外埠 $FRONTEND_PORT 可用"; else
  if [ "$CHECK_ONLY" -eq 1 ]; then need_fix "埠 ${WANT_F:-8080} 被佔用，會改用 $FRONTEND_PORT"; else fix "埠 ${WANT_F:-8080} 被佔用，改用 $FRONTEND_PORT"; fi
fi
if [ "$DB_HOST_PORT" = "${WANT_D:-3306}" ]; then ok "資料庫埠 ${DB_HOST_PORT}（只綁 127.0.0.1）可用"; else
  if [ "$CHECK_ONLY" -eq 1 ]; then need_fix "埠 ${WANT_D:-3306} 被佔用，會改用 $DB_HOST_PORT"; else fix "埠 ${WANT_D:-3306} 被佔用，改用 $DB_HOST_PORT"; fi
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  step "5/8 檢查 .env"
  if [ -f .env ]; then ok ".env 已存在（不會覆蓋）"; else need_fix ".env 不存在（會複製 .env.example 並產生隨機密鑰）"; fi
  printf '\n檢查完成。'
  if [ "$NEEDS_FIX" -eq 1 ]; then printf '有 [缺少] 的項目，執行 ./deploy.sh 時會自動補上。\n'; else printf '一切就緒，可以執行 ./deploy.sh 部署。\n'; fi
  exit 0
fi

# ---------- 5. .env ----------
step "5/8 準備 .env"
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

if [ ! -f .env ]; then
  fix "找不到 .env，複製 .env.example 並自動產生隨機密鑰"
  cp .env.example .env
  for VAR_NAME in DB_PASSWORD DB_ROOT_PASSWORD JWT_SECRET; do
    env_set "$VAR_NAME" "$(gen_secret)"
  done
  ok "已自動產生 .env（隨機密鑰僅存在這個檔案裡；需要用 DB 工具連線除錯時可查看 DB_PASSWORD）"
  warn "如需自訂設定（M365 單一登入、SMTP、CORS_ORIGIN 等），編輯 .env 後重新執行 ./deploy.sh 即可"
else
  ok ".env 已存在，保留原有設定"
fi
[ "$FRONTEND_PORT" = "8080" ] && [ -z "$(env_get FRONTEND_PORT)" ] || env_set FRONTEND_PORT "$FRONTEND_PORT"
[ "$DB_HOST_PORT" = "3306" ] && [ -z "$(env_get DB_HOST_PORT)" ] || env_set DB_HOST_PORT "$DB_HOST_PORT"
chmod 600 .env 2>/dev/null || true

# ---------- 6. 防火牆 ----------
step "6/8 檢查防火牆"
if [ "${SKIP_FIREWALL:-0}" = "1" ]; then
  ok "已略過（SKIP_FIREWALL=1）"
elif command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
  if $SUDO ufw status 2>/dev/null | grep -qE "^$FRONTEND_PORT(/tcp)?[[:space:]]+ALLOW"; then
    ok "ufw 已放行 $FRONTEND_PORT"
  else
    fix "ufw 啟用中，放行對外埠 $FRONTEND_PORT/tcp"
    $SUDO ufw allow "$FRONTEND_PORT/tcp" >/dev/null
  fi
elif command -v firewall-cmd >/dev/null 2>&1 && $SUDO firewall-cmd --state 2>/dev/null | grep -q running; then
  if $SUDO firewall-cmd --list-ports 2>/dev/null | grep -q "$FRONTEND_PORT/tcp"; then
    ok "firewalld 已放行 $FRONTEND_PORT"
  else
    fix "firewalld 啟用中，放行對外埠 $FRONTEND_PORT/tcp"
    $SUDO firewall-cmd --permanent --add-port="$FRONTEND_PORT/tcp" >/dev/null && $SUDO firewall-cmd --reload >/dev/null
  fi
else
  ok "沒有偵測到啟用中的防火牆（ufw／firewalld）"
fi

# ---------- 7. 建置並啟動 ----------
step "7/8 建置並啟動服務（第一次需要下載映像檔與編譯，約需數分鐘）"
$DOCKER compose up --build -d

# ---------- 8. 等服務就緒 ----------
step "8/8 等待服務就緒"
HEALTH_URL="http://127.0.0.1:$FRONTEND_PORT/api/health"
http_ok() {
  if command -v curl >/dev/null 2>&1; then curl -fsS -o /dev/null --max-time 3 "$1" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then wget -q -O /dev/null -T 3 "$1" 2>/dev/null
  else return 1; fi
}
i=0
READY=0
while [ "$i" -lt 90 ]; do
  if http_ok "$HEALTH_URL"; then READY=1; break; fi
  i=$((i + 1)); sleep 2
done
if [ "$READY" -ne 1 ]; then
  bad "等了 3 分鐘服務仍沒有回應，最近的紀錄如下："
  $DOCKER compose ps || true
  $DOCKER compose logs --tail 40 || true
  die "部署未完成，請依上面的紀錄排查（常見原因：.env 設定錯誤、埠被其他程式佔用）"
fi
ok "服務已就緒（${HEALTH_URL}）"

HOST_IP=""
if command -v hostname >/dev/null 2>&1; then HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"; fi
[ -n "$HOST_IP" ] || HOST_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -n "$HOST_IP" ] || HOST_IP="localhost"

printf '\n============================================================\n'
printf ' ✅ 部署完成\n'
printf '    網址：http://%s:%s\n' "$HOST_IP" "$FRONTEND_PORT"
# 只有「這次是新啟動」才顯示：容器紀錄會一直保留第一次啟動時的訊息，重複執行時再印出舊密碼
# 既不是「只顯示一次」，使用者改過密碼的話也會誤導
CREDS=""
if [ "$OWN_RUNNING" -eq 0 ]; then
  CREDS="$($DOCKER compose logs backend 2>/dev/null | grep -A3 "已自動建立初始管理員帳號" | grep -E "帳號：|密碼：" | sed 's/^[^|]*|[[:space:]]*//' | head -n 2 || true)"
fi
if [ -n "$CREDS" ]; then
  printf '    初始管理員帳號（只會顯示這一次，請立刻記下並登入後修改密碼）：\n'
  printf '%s\n' "$CREDS" | sed 's/^/      /'
else
  printf '    管理員帳號先前已建立，不會再顯示密碼（要重設請執行：./deploy.sh --reset-admin）\n'
fi
printf '============================================================\n\n'
printf '後續建議：\n'
printf '  • 到「系統設定」設定通知（SMTP 或 Teams），並按「傳送測試通知」\n'
printf '  • 正式使用前加上 HTTPS（反向代理＋憑證）；M365 單一登入也需要 HTTPS\n'
printf '  • 設定每日資料庫備份（見 DEPLOY.md）\n'
