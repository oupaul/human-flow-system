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

## API 端點

### 登入（公開，不需 token）
- `POST /api/auth/login` — `{ username, password }`，成功回傳 `{ token, user }`
- `GET /api/health` — 健康檢查

以下端點皆需在 Header 帶上 `Authorization: Bearer <token>`：

- `GET /api/auth/me` — 取得目前登入的使用者

### 部門管理
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/:id`
- `DELETE /api/departments/:id`

### 員工管理
- `GET /api/employees`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `PUT /api/employees/:id/terminate`

### 假別管理
- `GET /api/leave-types`
- `POST /api/leave-types`
- `GET /api/leave-applications`
- `POST /api/leave-applications`
- `PUT /api/leave-applications/:id/status`
- `GET /api/leave-balances`
- `PUT /api/leave-balances/:employeeId`
- `POST /api/leave-balances/recalculate` — 依所有在職員工到職日，依勞基法第 38 條重新計算特休天數（已用天數不變）

### 國定假日行事曆
- `GET /api/holidays?year=2026` — 取得（可選年度篩選）
- `POST /api/holidays` — 新增/更新單筆 `{ date, name, isHoliday }`
- `POST /api/holidays/import` — 匯入人事行政總處「政府行政機關辦公日曆表」CSV，`{ csv: "西元日期,星期,是否放假,備註\n20260101,四,2,開國紀念日\n..." }`（可至 [政府資料開放平台](https://data.gov.tw) 搜尋「政府行政機關辦公日曆表」下載官方 CSV，貼上內容即可，欄位辨識具彈性）
- `DELETE /api/holidays/:id`

### 加班申請
- `GET /api/overtime-applications`
- `POST /api/overtime-applications` — `{ employeeId, date, startTime, endTime, reason }`，時數自動換算，並依 `holidays` 表自動標記是否為假日加班
- `PUT /api/overtime-applications/:id/status` — `{ status, approver }`

### Dashboard
- `GET /api/dashboard/stats`
- `GET /api/dashboard/attendance`
- `GET /api/dashboard/leaves`
