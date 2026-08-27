# Docker 部署與測試指南

本專案以三個容器組成：

| 服務 | 說明 | 對外連接埠 |
|---|---|---|
| `frontend` | Nginx 提供前端靜態檔案，並將 `/api` 反向代理到 `backend` | `8080` |
| `backend` | Express API 伺服器 | 僅容器內網路可存取（不直接對外開放） |
| `db` | MariaDB，首次啟動會自動執行 `server/schema.sql` 建表 | `3306`（方便本機用 DB 工具連線除錯） |

## 前置需求

- Docker Desktop（或 Docker Engine + Docker Compose v2，`docker compose version` 需能執行）

## 步驟 1：設定環境變數

```sh
cp .env.example .env
```

編輯 `.env`，至少要改這幾個值：

```
DB_PASSWORD=改成你的密碼
DB_ROOT_PASSWORD=改成另一組密碼（MariaDB root 專用）
JWT_SECRET=改成一組長度足夠的隨機字串
```

`.env` 不會被提交到版本控制。

## 步驟 2：建置並啟動

```sh
npm run docker:up
# 等同於：docker compose up --build -d
```

第一次啟動時，`db` 容器會依 `server/schema.sql` 自動建立所有資料表與範例假別類型。

確認三個容器都正常運作：

```sh
docker compose ps
```

看到 `db`、`backend`、`frontend` 都是 `running`（`db` 需等到 `healthy`）即可。

## 步驟 3：建立管理員登入帳號

```sh
ADMIN_PASSWORD=你的密碼 docker compose run --rm -e ADMIN_PASSWORD backend node seed-admin.js
```

（也可以用 `npm run docker:seed-admin`，但需要先手動 `export ADMIN_PASSWORD=你的密碼`）

看到 `✅ 已建立/更新管理員帳號：admin` 即成功。可用 `-e ADMIN_USERNAME=自訂帳號` 改帳號名稱。

### 既有部署升級：套用特休週年結算功能

如果你的 `db_data` volume 是在「特休週年結算」功能上線前就建立的（已經有資料），需要額外套用結構異動並補建既有員工的週年紀錄：

```sh
docker compose exec -T db mysql -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/001_leave_periods.sql
npm run docker:migrate-leave-periods
```

全新安裝（第一次啟動 `db` 容器）不需要這步，`schema.sql` 已經包含最新結構。

## 步驟 4：測試

### 4.1 後端健康檢查

```sh
curl http://localhost:8080/api/health
# 應回傳 {"status":"ok",...}
```

### 4.2 登入 API

```sh
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"你剛才設定的密碼"}'
# 應回傳 { "token": "...", "user": {...} }
```

### 4.3 瀏覽器完整測試

打開 `http://localhost:8080`：

1. 應自動導向 `/login`，用剛建立的帳密登入
2. 登入後檢查各頁面：
   - **Dashboard**：統計數字、圖表是否正常顯示（資料庫剛建立時多數會是 0，屬正常）
   - **員工管理**：新增一筆員工 → 確認「假別管理 → 假別餘額」自動出現該員工的特休天數
   - **部門管理**：新增/編輯/刪除部門
   - **假別管理**：
     - 「假別設定」應看到 6 筆範例假別（特休、事假、病假…）
     - 用剛新增的員工編號提交一筆請假申請 → 核准/拒絕
     - 「加班申請」提交一筆加班 → 核准/拒絕
     - 「國定假日」貼上一段測試 CSV 匯入，確認列表出現
   - 點側邊欄「登出」→ 應導回登入頁，且未登入時直接刷新任何頁面都會被導向 `/login`

### 4.4 確認未登入無法呼叫 API（驗證安全性）

```sh
curl -o /dev/null -s -w "%{http_code}\n" http://localhost:8080/api/employees
# 應回傳 401
```

## 常見問題

- **backend 容器一直重啟 / 連不上資料庫**：多半是 `db` 還沒 healthy 就被連線，或 `.env` 密碼與 compose 沒對上。查看記錄：`docker compose logs backend`、`docker compose logs db`。
- **改了程式碼但沒生效**：容器內的程式碼是建置時複製進去的，改完要重新建置：`docker compose up --build -d`。
- **想清空重來（含資料庫資料）**：`docker compose down -v`（`-v` 會刪除 `db_data` volume，資料庫內容會全部清空，請確認不需要保留再執行）。

## 停止服務

```sh
npm run docker:down
# 等同於：docker compose down
```

（不加 `-v`，資料庫資料會保留在 `db_data` volume，下次 `docker:up` 資料還在）

## 查看即時日誌

```sh
npm run docker:logs
```
