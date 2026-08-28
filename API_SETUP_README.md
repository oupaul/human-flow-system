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

**已存在資料庫的既有部署**，依序套用尚未執行過的遷移檔（`server/migrations/` 目錄下按編號順序）：

```sh
mysql -u root -p hrms_database < server/migrations/001_leave_periods.sql
npm run migrate:leave-periods   # 幫既有在職員工補建目前這期的特休週年紀錄

mysql -u root -p hrms_database < server/migrations/002_leave_grants.sql   # 假別核給功能

npm run fix:leave-periods   # 修正舊版 bug 造成的錯誤特休週年紀錄（到職日回填多年前時發放天數算錯），可重複執行
```

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

## 特休（週年制）如何運作

- 每位員工有一連串的「特休週年期間」（`leave_periods` 表），從到職日起每滿一年一期，每期的發放天數依勞基法第 38 條年資級距計算（`server/index.js` 的 `computePeriodGrant`）。
- 新增員工時自動建立第一期；核准一筆假別代碼為 `AL`（特休）的請假申請時，會自動累加到目前這期的已用天數；若把已核准的申請改回其他狀態，會自動退回。
- 「假別餘額」畫面的特休可用/已用天數，是即時從目前尚未結算的那一期算出來的（可用＝本期發放＋上期遞延，已用＝本期已核准天數），不是固定寫死的數字。
- **週年到期不會自動結算**，需要 HR 到「假別管理 → 特休結算」分頁手動處理：系統會列出所有已到期但尚未結算的期間，並算好「應強制折現天數」（上一期遞延進來、這期還是沒休完的部分，依法不可再遞延）與「可選遞延或折現天數」（這期新發放但沒休完的部分）。HR 輸入要遞延多少天到下一期，其餘自動折算成應發工資天數，並依員工的月薪試算金額（公式為 `未休天數 × 月薪 ÷ 30`，四捨五入到整數；請自行確認是否符合貴公司對「平均日薪」的定義）。結算後會自動開出下一期。
- 折現金額只是**試算**，本系統不處理實際發薪；請將結算結果交給薪資/會計作業。

## API 端點

### 登入（公開，不需 token）
- `POST /api/auth/login` — `{ username, password }`，成功回傳 `{ token, user }`
- `GET /api/health` — 健康檢查

以下端點皆需在 Header 帶上 `Authorization: Bearer <token>`：

- `GET /api/auth/me` — 取得目前登入的使用者
- `PUT /api/auth/change-password` — `{ currentPassword, newPassword }`，任何登入者皆可自行修改密碼，需先驗證目前密碼正確

### 部門管理（僅 HR/主管）
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/:id`
- `DELETE /api/departments/:id`

### 員工管理（僅 HR/主管）
- `GET /api/employees`
- `POST /api/employees` — 新增員工時會自動建立對應的員工登入帳號與第一期特休週年紀錄；可選帶 `initialAnnualLeaveUsed`，登記系統上線前該員工已休掉的特休天數（預設 0）
- `POST /api/employees/import` — `{ csv }` 批次匯入，標題列需含姓名/員工編號/部門/職位/電子郵件/到職日（電話/地址/備註/月薪/已用特休天數選填，欄位可任意排序），逐列處理、單列失敗不影響其他列，回傳 `{ created, failed: [{ row, employeeId, error }] }`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `PUT /api/employees/:id/terminate` — 員工離職時會一併停用其登入帳號
- `POST /api/employees/:id/reset-password` — 將該員工登入密碼重設為預設值（＝員工編號），無帳號時會一併建立

### 假別管理
- `GET /api/leave-types` — 所有登入者皆可查詢
- `POST /api/leave-types`（僅 HR/主管）
- `GET /api/leave-applications` — 員工只會看到自己的申請，HR/主管看到全公司
- `POST /api/leave-applications` — 員工角色送出時會強制以自己的 employeeId 覆蓋，無法代他人申請
- `POST /api/leave-applications/:id/attachment` — 上傳證明文件（`multipart/form-data`，欄位名 `file`，僅接受 JPG/PNG/WEBP/PDF，5MB 以內），本人或 HR/主管可上傳，重複上傳會覆蓋舊檔
- `GET /api/leave-applications/:id/attachment` — 下載證明文件，本人或 HR/主管可下載
- `PUT /api/leave-applications/:id/status`（僅 HR/主管審核）— `{ status, approver, days }`，`days` 可選，用於核准時依證明文件調整實際核准天數（例如喪假依親屬關係核定 3/6/8 天），不帶則沿用申請時的天數
- `GET /api/leave-balances` — 員工只會看到自己的餘額
- `PUT /api/leave-balances/:employeeId`（僅 HR/主管）
- `POST /api/leave-balances/recalculate`（僅 HR/主管）— 重新整理所有在職員工「目前這期」的特休發放天數（用於到職未滿一年、跨過年資級距門檻等情況），已用天數不變
- `PUT /api/leave-periods/:id`（僅 HR/主管）— `{ usedDays }`，直接調整某期特休的已用天數。用於系統上線時導入既有員工事後補登已休天數，或更正誤植的核准紀錄

### 特休週年結算（僅 HR/主管）
- `GET /api/leave-periods?employeeId=EMP001` — 查詢特休週年紀錄（含歷史已結算的期間），不帶 employeeId 則列出全公司
- `GET /api/leave-periods/pending-settlement` — 列出已到期但尚未結算的期間，並附計算好的應強制折現天數與可選遞延/折現天數
- `POST /api/leave-periods/:id/settle` — `{ carryOverDays }`，結算一期並自動開出下一期；回傳折現天數、折現金額（依員工月薪試算，未設定月薪則為 `null`）與遞延天數

### 假別核給（僅 HR/主管）
適用喪假、婚假等「同一事由分次請假」的假別：HR 審核員工提供的證明文件後，直接核給總天數與應休畢期限，之後同一員工、同一假別的請假申請會自動關聯到這筆核給並從中扣抵，核准時若超過剩餘天數會被擋下（回傳 400）。
- `GET /api/leave-grants?employeeId=EMP001` — 查詢核給紀錄，不帶 employeeId 則列出全公司
- `POST /api/leave-grants` — `{ employeeId, leaveTypeId, totalDays, deadline, note }`，`deadline`/`note` 選填
- `DELETE /api/leave-grants/:id` — 刪除核給紀錄（僅未被任何已核准申請使用時可刪）

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
