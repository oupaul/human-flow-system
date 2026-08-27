# API 伺服器設置說明

本專案的後端 API 伺服器在 `server/index.js`，使用 Express + MySQL/MariaDB，並以 JWT 驗證登入。

## 前置需求

- Node.js 18+
- 一個 MariaDB / MySQL 資料庫

## 步驟 1：設定環境變數

複製 `.env.example` 為 `.env`，並填入你的資料庫連線資訊與一組隨機的 `JWT_SECRET`：

```sh
cp .env.example .env
```

`.env` 內容說明：

```
PORT=3001
CORS_ORIGIN=http://localhost:8080

DB_HOST=localhost
DB_USER=hrms_user
DB_PASSWORD=你的資料庫密碼
DB_NAME=hrms_database
DB_PORT=3306

JWT_SECRET=一組長度足夠的隨機字串
JWT_EXPIRES_IN=8h
```

## 步驟 2：建立資料表

完整結構定義於 [`server/schema.sql`](server/schema.sql)（部門、員工、假別類型/申請/餘額、國定假日、加班申請、登入帳號，並附範例假別類型資料）。

```sh
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS hrms_database"
mysql -u root -p hrms_database < server/schema.sql
```

（使用 Docker 部署時此步驟會自動執行，詳見 [`DEPLOY.md`](DEPLOY.md)）

## 步驟 3：安裝套件並建立管理員帳號

```sh
npm install
ADMIN_PASSWORD=請改成你的密碼 npm run seed:admin
```

這會在 `users` 表建立（或更新）一個 `admin` 帳號，密碼會以 bcrypt 雜湊後儲存。可用 `ADMIN_USERNAME` 自訂帳號名稱。

## 步驟 4：啟動伺服器

```sh
# 後端 API（http://localhost:3001）
npm run server

# 另開一個終端機啟動前端（http://localhost:8080，已設定 proxy 轉發 /api）
npm run dev
```

## 角色與權限

`users.role` 分兩類：

- **HR/主管**（`admin`、`hr`、`manager`）：可管理部門、員工、假別設定、國定假日，並審核所有請假/加班申請（目前不分部門，任一角色皆可審核全公司）。
- **員工**（`employee`）：只能看到並操作自己的資料——提交請假/加班申請、查看自己的申請紀錄與假別餘額；無法存取部門/員工管理、Dashboard、審核他人申請。

員工登入帳號會在 HR 於「員工管理」新增員工時**自動建立**：帳號＝員工的電子郵件、預設密碼＝員工編號，角色固定為 `employee`。之後若編輯員工資料變更 email，登入帳號會自動同步。HR 也可在員工列表對任一員工按「重設密碼」按鈕，將密碼重設回員工編號（同時補建帳號，適用於系統升級前就存在的舊員工）。員工登入後導向 `/my` 自助服務頁面；HR/主管登入後導向原本的管理後台。

## API 端點

### 登入（公開，不需 token）
- `POST /api/auth/login` — `{ username, password }`，成功回傳 `{ token, user }`
- `GET /api/health` — 健康檢查

以下端點皆需在 Header 帶上 `Authorization: Bearer <token>`：

- `GET /api/auth/me` — 取得目前登入的使用者

### 部門管理（僅 HR/主管）
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/:id`
- `DELETE /api/departments/:id`

### 員工管理（僅 HR/主管）
- `GET /api/employees`
- `POST /api/employees` — 新增員工時會自動建立對應的員工登入帳號
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `PUT /api/employees/:id/terminate` — 員工離職時會一併停用其登入帳號
- `POST /api/employees/:id/reset-password` — 將該員工登入密碼重設為預設值（＝員工編號），無帳號時會一併建立

### 假別管理
- `GET /api/leave-types` — 所有登入者皆可查詢
- `POST /api/leave-types`（僅 HR/主管）
- `GET /api/leave-applications` — 員工只會看到自己的申請，HR/主管看到全公司
- `POST /api/leave-applications` — 員工角色送出時會強制以自己的 employeeId 覆蓋，無法代他人申請
- `PUT /api/leave-applications/:id/status`（僅 HR/主管審核）
- `GET /api/leave-balances` — 員工只會看到自己的餘額
- `PUT /api/leave-balances/:employeeId`（僅 HR/主管）
- `POST /api/leave-balances/recalculate`（僅 HR/主管）— 依所有在職員工到職日，依勞基法第 38 條重新計算特休天數（已用天數不變）

### 國定假日行事曆
- `GET /api/holidays?year=2026` — 所有登入者皆可查詢（可選年度篩選）
- `POST /api/holidays`（僅 HR/主管）— 新增/更新單筆 `{ date, name, isHoliday }`
- `POST /api/holidays/import`（僅 HR/主管）— 匯入人事行政總處「政府行政機關辦公日曆表」CSV，`{ csv: "西元日期,星期,是否放假,備註\n20260101,四,2,開國紀念日\n..." }`（可至 [政府資料開放平台](https://data.gov.tw) 搜尋「政府行政機關辦公日曆表」下載官方 CSV，貼上內容即可，欄位辨識具彈性）
- `DELETE /api/holidays/:id`（僅 HR/主管）

### 加班申請
- `GET /api/overtime-applications` — 員工只會看到自己的申請，HR/主管看到全公司
- `POST /api/overtime-applications` — `{ employeeId, date, startTime, endTime, reason }`，時數自動換算，並依 `holidays` 表自動標記是否為假日加班；員工角色送出時會強制以自己的 employeeId 覆蓋
- `PUT /api/overtime-applications/:id/status`（僅 HR/主管審核）— `{ status, approver }`

### Dashboard（僅 HR/主管）
- `GET /api/dashboard/stats`
- `GET /api/dashboard/attendance`
- `GET /api/dashboard/leaves`
