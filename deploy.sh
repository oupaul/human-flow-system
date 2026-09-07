#!/bin/sh
# 一鍵部署：git clone 之後直接執行這支腳本即可完成部署，不需要手動編輯 .env。
#
#   git clone <repo>
#   cd human-flow-system
#   ./deploy.sh
#
# 第一次執行、且 .env 還不存在時，會自動複製 .env.example 並產生隨機的
# DB_PASSWORD / DB_ROOT_PASSWORD / JWT_SECRET。已經存在的 .env 不會被覆蓋，
# 保留給需要自訂設定（M365 單一登入、SMTP、CORS_ORIGIN 等）的部署直接編輯後
# 重新執行。初始管理員帳號會在 backend 容器啟動時自動建立（僅限完全沒有
# 任何管理員帳號時），密碼只會印在第一次啟動的 log 裡。
set -e
cd "$(dirname "$0")"

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

if [ ! -f .env ]; then
  echo "找不到 .env，複製 .env.example 並自動產生隨機密鑰..."
  cp .env.example .env
  for VAR_NAME in DB_PASSWORD DB_ROOT_PASSWORD JWT_SECRET; do
    VALUE=$(gen_secret)
    sed "s|^${VAR_NAME}=.*|${VAR_NAME}=${VALUE}|" .env > .env.tmp
    mv .env.tmp .env
  done
  echo "已自動產生 .env（隨機密鑰僅存在本機這個檔案裡，需要用 DB 工具連線除錯時可直接查看 .env 內的 DB_PASSWORD）"
  echo "如需自訂設定（M365 單一登入、SMTP、CORS_ORIGIN 等），可編輯 .env 後重新執行 ./deploy.sh"
  echo ""
fi

echo "建置並啟動服務..."
docker compose up --build -d

echo ""
echo "服務已啟動。初始管理員帳號會在 backend 容器就緒後自動建立（若尚未有任何管理員帳號），"
echo "請稍候幾秒後執行下列指令查看帳號密碼："
echo ""
echo "  docker compose logs backend | grep -B1 -A4 已自動建立初始管理員帳號"
echo ""
echo "登入後請盡快至「個人設定」修改密碼。"
