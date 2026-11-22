# Docker 部署與測試指南

本專案以三個容器組成：

| 服務 | 說明 | 對外連接埠 |
|---|---|---|
| `frontend` | Nginx 提供前端靜態檔案，並將 `/api` 反向代理到 `backend` | `8080`（可用 `.env` 的 `FRONTEND_PORT` 修改） |
| `backend` | Express API 伺服器（含請假證明文件，存在 `uploads_data` volume） | 僅容器內網路可存取（不直接對外開放） |
| `db` | MariaDB，首次啟動會自動執行 `server/schema.sql` 建表 | 只綁定在主機的 `127.0.0.1:3306`（**不對外**；可用 `.env` 的 `DB_HOST_PORT` 修改）。要用 DB 工具連線請在主機上操作，或用 SSH 通道 |

## 前置需求

**不需要事先安裝任何東西。** `deploy.sh` 會自動檢查，缺 Docker 就幫你裝（見下一節）。唯一的要求是：
- Linux（Ubuntu／Debian／CentOS／RHEL／Fedora 等）需要 root 或 sudo，才能安裝套件與設定防火牆
- macOS／Windows 無法自動安裝：請先裝 Docker Desktop 或 OrbStack 並啟動

## 一鍵部署（新環境，兩個指令）

```sh
git clone <repo> && cd human-flow-system
./deploy.sh
```

`deploy.sh` 會依序檢查，**缺什麼就自動補上**，最後等服務真的可以使用才結束：

| 步驟 | 檢查內容 | 缺少時 |
|---|---|---|
| 1 | 作業系統與權限（root／sudo） | 提示 |
| 2 | Docker、Docker 服務、目前帳號的權限、Docker Compose v2 | 沒裝就用 Docker 官方腳本自動安裝；服務沒啟動就啟動；沒權限就改用 sudo 並把帳號加入 `docker` 群組 |
| 3 | 磁碟空間（至少 2 GB，建議 5 GB）、記憶體（建議 2 GB） | 空間不足會停止；記憶體偏低只警告 |
| 4 | 網頁埠（預設 8080）與資料庫埠（預設 3306）有沒有被佔用 | 自動換成下一個可用的埠，並寫進 `.env` |
| 5 | `.env` | 不存在就複製 `.env.example` 並產生隨機的 `DB_PASSWORD`／`DB_ROOT_PASSWORD`／`JWT_SECRET`（已存在的絕不覆蓋） |
| 6 | 防火牆（只處理啟用中的 ufw／firewalld） | 自動放行網頁埠；不想讓它動防火牆：`SKIP_FIREWALL=1 ./deploy.sh` |
| 7 | 建置並啟動 | `docker compose up --build -d` |
| 8 | 等待服務就緒（health check） | 3 分鐘內沒回應就印出紀錄並停止 |

完成後會印出網址，以及**初始管理員帳號與密碼**（只有第一次啟動會顯示一次，請立刻記下並登入後修改）。重複執行 `./deploy.sh` 是安全的：不會覆蓋 `.env`、沿用同一個埠、不會再顯示密碼。

只想檢查環境、不做任何變更：

```sh
./deploy.sh --check
```

初始管理員帳號只會在資料庫裡完全沒有管理員時自動建立，不會覆蓋既有帳號。如果之後要重設密碼，用下面「步驟 3」的 `seed-admin.js`（跟自動建立是兩支不同的腳本，`seed-admin.js` 會覆蓋密碼，自動建立的那支不會）：

```sh
docker compose run --rm backend node seed-admin.js
```

如果需要在啟動前先自訂設定（M365 單一登入、SMTP、`CORS_ORIGIN` 等非隨機生成的值），請改用下面「步驟 1～3」的手動流程，或是先執行 `cp .env.example .env` 編輯好想要的值後再執行 `./deploy.sh`（腳本偵測到 `.env` 已存在就不會覆蓋，只會直接啟動）。

## 手動部署（需要自訂設定時）

### 步驟 1：設定環境變數

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

如果要開啟「使用 Microsoft 帳號登入」（M365 SSO，選用），只需要設定 `MS_TENANT_ID`/`MS_CLIENT_ID` 兩個公開識別碼（**不需要 client secret**，採用 PKCE；需要 HTTPS），完整設定步驟見 [`API_SETUP_README.md`](API_SETUP_README.md#microsoft-365-單一登入選用)。沒設定就不會出現這個登入選項，不影響原本的帳號密碼登入。

### 步驟 2：建置並啟動

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

### 步驟 3：建立管理員登入帳號

```sh
ADMIN_PASSWORD=你的密碼 docker compose run --rm -e ADMIN_PASSWORD backend node seed-admin.js
```

（也可以用 `npm run docker:seed-admin`，但需要先手動 `export ADMIN_PASSWORD=你的密碼`）

看到 `✅ 已建立/更新管理員帳號：admin` 即成功。可用 `-e ADMIN_USERNAME=自訂帳號` 改帳號名稱。這支腳本每次執行都會覆蓋密碼，也用於之後重設密碼；跟「快速部署」流程裡自動建立初始帳號的 `auto-seed-admin.js` 是兩支不同的腳本（那支只在完全沒有管理員帳號時才會建立一次，不會覆蓋既有密碼）。

### 既有部署升級：套用資料庫結構異動

如果你的 `db_data` volume 是在某個功能上線前就建立的（已經有資料），需要依序套用尚未執行過的遷移檔（`server/migrations/` 目錄下按編號順序）：

```sh
# 特休週年結算功能
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/001_leave_periods.sql
npm run docker:migrate-leave-periods

# 假別核給功能（喪假/婚假等同一事由分次請假）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/002_leave_grants.sql

# 審核備註功能（核准/拒絕皆可填寫）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/003_review_notes.sql

# 通知設定改成存在資料庫，透過「系統設定」頁面管理（僅 admin 可見）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/004_notification_settings.sql

# 補休功能（加班可選換補休，依費率換算時數，透過請假申請使用）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/005_comp_time.sql

# 補上生理假假別
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/006_menstrual_leave.sql

# 員工新增性別欄位（用於限制生理假僅女性員工可請）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/007_employee_gender.sql

# 考勤匯入功能（員工新增考勤帳號欄位、新增考勤紀錄表）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/008_attendance.sql

# 請假紀錄匯入功能（報表「請假分析」可匯入外部系統匯出的請假紀錄）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/009_leave_import.sql

# 通知設定新增「允許自簽憑證」選項（公司自架郵件伺服器常見需要）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/010_smtp_self_signed.sql

# 年資福利提醒（旅遊補助、留任獎金等依年資觸發的提醒）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/011_seniority_benefits.sql

# 節日福利提醒（開工紅包、端午禮金、中秋禮金等日期每年不固定的全公司福利）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/012_holiday_benefits.sql

# 特休週年結算提醒（週年日前通知 HR，記錄是否已通知避免重複）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/013_leave_settlement_reminder.sql

# 薪資異動歷史與勞保／健保／勞退投保薪資（既有月薪會自動轉成第一筆紀錄）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/014_employee_compensation.sql

# 人事成本：保險費率與級距表、每月勞健退試算快照
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/015_payroll.sql

# 特休／補休調整異動記錄
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/016_leave_adjustment_logs.sql

# 薪資計算：計薪區間內的加班費與請假扣薪
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/017_payroll_variable.sql

# 排班制：員工出勤制度、假日津貼規則
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/018_schedule_mode_allowance.sql

# 自建打卡（階段 A）：打卡事件、裝置綁定、IP 限制、員工出勤來源、首次登入強制改密碼
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/019_punch.sql

# 自建打卡階段 B：班別與月份班表、補卡申請、公出、缺卡異常記錄
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/020_schedule_requests.sql

# 打卡異常統計：記錄被擋下的打卡嘗試（只從套用後開始記錄）
docker compose exec -T db mariadb -u root -p"你的 DB_ROOT_PASSWORD" hrms_database < server/migrations/021_punch_rejections.sql
```

> 套用 019 後，既有「員工」角色帳號下次登入必須先修改密碼。另外容器時區已改為 Asia/Taipei，升級時請重建容器（`docker compose up --build -d`）。

全新安裝（第一次啟動 `db` 容器）不需要這步，`schema.sql` 已經包含最新結構。

### 既有部署升級：修正錯誤的特休週年紀錄

舊版新增員工的邏輯有 bug：填入多年前的到職日時，特休週年區間會被建立成「到職日起算的第一年」，導致發放天數用了剛到職那年的級距，而不是實際年資對應的天數（例如年資 18 年卻只給 3 天）。更新到含此修正的版本後，執行一次即可修正所有已受影響的紀錄（已用天數不會被改動，重複執行也安全）：

```sh
npm run docker:fix-leave-periods
```

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
     - 「假別設定」應看到 8 筆範例假別（特休、事假、病假、生理假、婚假、公假、喪假、補休）
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
