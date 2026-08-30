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

mysql -u root -p hrms_database < server/migrations/003_review_notes.sql   # 審核備註功能（核准/拒絕皆可填寫）

mysql -u root -p hrms_database < server/migrations/004_notification_settings.sql   # 通知設定改成存在資料庫，透過「系統設定」頁面管理

mysql -u root -p hrms_database < server/migrations/005_comp_time.sql   # 補休功能（加班可選換補休，依費率換算時數）

mysql -u root -p hrms_database < server/migrations/006_menstrual_leave.sql   # 補上生理假假別

mysql -u root -p hrms_database < server/migrations/007_employee_gender.sql   # 員工新增性別欄位（用於限制生理假僅女性員工可請）

mysql -u root -p hrms_database < server/migrations/008_attendance.sql   # 考勤匯入功能（員工新增考勤帳號欄位、新增考勤紀錄表）

mysql -u root -p hrms_database < server/migrations/009_leave_import.sql   # 請假紀錄匯入功能（報表「請假分析」可匯入外部系統匯出的請假紀錄）

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

## 加班與補休時數如何計算（含午休扣除）

- 加班申請與補休請假（假別選「補休」）都是同一天內填開始/結束時間，系統以「結束時間－開始時間」計算時數，**並自動扣除與中午 12:00–13:00 午休時段重疊的部分**，例如整天加班 09:00–18:00 只會算 8 小時，不會把午休那 1 小時也算進去。這個規則寫在 `server/index.js` 的 `calculateWorkingHours` 函式（含 `LUNCH_BREAK_START_MINUTES`/`LUNCH_BREAK_END_MINUTES` 兩個常數），如果貴公司午休時段不是 12:00–13:00，請直接修改這兩個常數。
- 如果選擇的時段整段都落在午休時間內（例如 12:00–13:00），扣除後時數會是 0，系統會擋下申請並提示「扣除午休時段後時數需大於 0」。

## 補休如何運作

- 員工提出加班申請時，可選擇這次要「領加班費」或「換補休」，由**員工自己決定**（比照勞基法第 32-1 條「經勞雇雙方協商同意」的精神）。
- 選擇換補休且核准後，系統依勞基法第 32-1 條以工作時數 **1:1** 開立補休額度（加班 1 小時＝補休 1 小時，這是法定最低標準，不套用加班費的加成倍率），存在 `comp_time_grants` 表，應休畢期限為加班日起 6 個月。如果貴公司要從優給予（例如比照加班費倍率多給），屬於勞雇雙方另外約定的範圍，需自行調整 `server/index.js` 的 `calculateCompHours` 函式。
- 補休透過「假別管理 / 我的入口」的**請假申請**使用：假別選「補休」後，改為輸入同一天的開始/結束時間（以小時為單位），核准時系統會依到期日由近到遠自動扣抵額度，額度不足會擋下核准。
- 「假別餘額」畫面的補休可用/已用天數，即時從尚未到期、尚未結算的補休額度加總算出，**不再開放手動調整**（來源是加班核准，不是憑空輸入的數字）；HR 可在「補休明細」查看每筆補休的來源加班紀錄與到期日。
- **到期不會自動結算**，需要 HR 到「假別管理 → 特休結算」分頁下方的「補休結算」區塊手動處理：已逾期但還有剩餘時數的補休額度會被列出，剩餘時數全數折算加班費（依員工月薪換算的時薪 `月薪 ÷ 240`，四捨五入到整數），折算金額同樣只是**試算**，不處理實際發薪。
- **到期前 14 天會主動提醒**：伺服器每天檢查一次，把剛好還有 14 天到期、尚未休完的補休額度整理成一則通知，走「系統設定」設定的通知通道發給 HR/主管（走現有的 email/Teams 通知機制，不是另外寄給員工本人）。同一份清單也能在「假別管理 → 特休結算」分頁下方的「補休即將到期」區塊、以及 Dashboard（有即將到期的才會顯示卡片）看到，範圍是未來 30 天內。這是簡化版設計：伺服器如果剛好在到期前 14 天那天沒有在跑，會錯過那筆提醒；也沒有防重複機制，同一天內伺服器重啟多次可能重複發送——如果貴公司需要更嚴謹的保證送達，需要自行調整 `server/index.js` 的 `checkCompTimeExpiryReminders` 函式。

## 系統通知設定（選用）

員工送出請假或加班申請時，系統可以主動通知 HR/主管去審核，不用只靠 Dashboard 的待審核數字。**設定在網頁上就能改**：以 `admin` 角色登入後，側邊欄會出現「系統設定」，進去「通知設定」選擇通道並填寫，儲存後可以直接按「傳送測試通知」確認有沒有設定對。只有 `admin` 角色看得到這個頁面（HR/主管看不到，因為裡面會有密碼、金鑰等敏感資訊）。

設定實際存在資料庫的 `notification_settings` 表（單一列）。`.env` 裡的 `NOTIFICATION_CHANNEL`、`SMTP_*`、`TEAMS_WEBHOOK_URL` 只在資料庫**還沒有任何設定紀錄時**當作初始值用一次（方便舊版純環境變數部署直接沿用），之後一律以資料庫內容、也就是「系統設定」頁面上看到的為主，改 `.env` 不會再生效。

**Email（SMTP）通道**：

- 一般帳密登入：填 SMTP 帳號、密碼即可。
- OAuth2（適用 Microsoft 365、Google Workspace 等已停用密碼登入 Basic Auth 的信箱）：需要你自行到該信箱服務商後台申請一組應用程式並取得 refresh token（Microsoft：在 Entra ID/Azure AD 註冊應用程式並授予寄信權限；Google：在 Google Cloud Console 啟用 Gmail API 並建立 OAuth 用戶端，可用 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) 取得測試用 refresh token）。這是信箱服務商的一次性設定，本系統不提供 OAuth 授權流程頁面，拿到 Client ID/Secret/refresh token 後直接貼進設定頁面即可。

**Teams 通道**：在目標頻道設定「傳入 Webhook」連接器，取得 Webhook 網址後貼進設定頁面。目前是用傳統 MessageCard 格式；如果貴組織改用較新的 Power Automate 工作流程 Webhook，payload 格式不同，需要調整 `server/notifications.js` 的 `sendTeams` 函式。

密碼/金鑰類欄位（SMTP 密碼、OAuth Client Secret、refresh token、Teams Webhook 網址）**以明文存在資料庫**，本系統目前沒有對這些欄位做額外加密，僅靠 `admin` 角色權限與一般資料庫存取控管保護，請確保正式環境的資料庫本身有適當的存取限制。

通知發送失敗（設定錯誤、網路問題等）只會記錄在後端 log，不會影響申請/審核等主要功能正常運作。

## Microsoft 365 單一登入（選用）

登入頁可以加一個「使用 Microsoft 帳號登入」按鈕，讓員工直接用公司的 M365 帳號登入，不用另外記系統密碼。這是**跟現有帳號密碼登入並存**的選項，不會取代原本的登入方式；`.env` 沒設定時登入頁根本不會出現這個按鈕。

**運作方式**：只限貴公司自己的 M365 租戶（tenant）內的帳號能登入，其他租戶或個人 Microsoft 帳號在 Microsoft 自家登入頁就會被擋下。登入成功後，系統會用 Microsoft 回傳的電子郵件去比對 `users` 表的帳號（跟一般登入邏輯完全相同——員工帳號的 username 本來就是電子郵件），**找不到對應帳號會直接被拒絕**、導回登入頁並提示「請聯絡管理員」，不會自動建立新帳號。也就是說，要能用 M365 SSO 登入，員工必須已經被 HR 在「員工管理」新增過（會自動建立登入帳號）或透過批次匯入建立。

**設定步驟（需要 Azure/Microsoft 365 系統管理員權限）**：

1. 到 [Microsoft Entra 系統管理中心](https://entra.microsoft.com)（或 Azure Portal）→ 「應用程式註冊」→「新增註冊」
2. 名稱自訂（例如「HR管理系統」），支援的帳戶類型選**「僅此組織目錄中的帳戶（單一租戶）」**，重新導向 URI 類型選 **Web**，網址填 `.env` 裡 `MS_REDIRECT_URI` 的值（例如 `https://你的網域/api/auth/microsoft/callback`，正式環境請用 HTTPS）
3. 註冊完成後，在應用程式「總覽」頁記下 **應用程式 (用戶端) 識別碼**（→ `MS_CLIENT_ID`）與 **目錄 (租用戶) 識別碼**（→ `MS_TENANT_ID`）
4. 左側選單「憑證及密碼」→「用戶端密碼」→「新增用戶端密碼」，建立後**立刻複製「值」**（離開頁面後就看不到了）→ `MS_CLIENT_SECRET`
5. 左側選單「API 權限」確認已有 `Microsoft Graph` 的 `User.Read`（委派）權限，這是新註冊應用程式的預設權限，通常不用額外設定
6. 把上面四個值填進 `.env`：`MS_TENANT_ID`、`MS_CLIENT_ID`、`MS_CLIENT_SECRET`、`MS_REDIRECT_URI`，重新啟動服務即可
7. 到登入頁確認出現「使用 Microsoft 帳號登入」按鈕，用一個已存在系統帳號的 M365 信箱測試登入

`MS_REDIRECT_URI` 要注意：不管是本機開發還是 Docker 部署，`/api` 都是透過對外網址（`CORS_ORIGIN` 那個網址，Vite/nginx 會轉發到後端）存取，後端的 3001 埠本身沒有對外開放，所以這裡務必填對外網址，不是 `http://localhost:3001/...`（詳見 `.env.example` 裡的說明）。

`MS_CLIENT_SECRET` 目前**以明文存在環境變數**（跟 Email 通知的 SMTP 密碼/OAuth 設定同樣的限制），請確保 `.env` 檔案本身的存取權限受控制，不要提交到版本控制（已列在 `.gitignore`）。

## 考勤匯入與分析

本系統**不提供打卡功能**，考勤資料是從外部打卡系統匯出的 `.xls` 檔案匯入的。在「報表分析 → 出勤分析」分頁上傳檔案即可，會員工/主管都能自動比對統計。

**運作方式**：

- 匯入前，需要先在「員工管理」幫每位員工填上「考勤帳號」欄位——就是外部打卡系統裡那個人的帳號（例如 `nicole`），系統靠這個欄位把匯入的每一列資料對應到正確的員工，員工編號、姓名都不會拿來比對（因為外部系統的帳號格式通常跟本系統的員工編號、email 對不上）。可以在新增/編輯員工時手動填，或批次匯入 CSV 時用「考勤帳號」欄位一次填。
- 支援的檔案格式：橫向的月曆式匯出檔——每一列是一位員工（可能因排班設定重複出現多列），標題列是「部門、人員帳號、人員姓名、班別」接著每天兩欄（簽到／簽退），日期格式如「07-01」不含年份，匯入時需另外指定西元年。這是目前測試過的其中一種打卡系統匯出格式；如果貴公司的匯出格式欄位順序或標題文字不同，需要調整 `server/index.js` 的 `parseAttendanceXls` 函式。
- 儲存格內容除了時間（如 `09:02`）以外，「缺卡」會記為缺卡狀態；「休息日」「例假日」記為休息日；「特休」「事假」「病假」「生理假」「婚假」「公假」「喪假」「補休」等假別文字記為請假狀態（**只是原樣存起來顯示參考用，不會影響本系統自己的請假額度或核准紀錄**，兩邊的請假資料是分開的）。
- 匯入採 UPSERT（同一位員工同一天再匯入一次會覆蓋舊資料），可以重複匯入同一份檔案或匯入修正後的檔案不會產生重複紀錄。
- 找不到對應「考勤帳號」的資料列不會被匯入，會在匯入結果裡列出未比對到的帳號清單，供 HR 補上員工的考勤帳號後重新匯入。
- 「出勤分析」統計表裡的遲到／早退，是拿實際簽到退時間跟匯入檔裡「班別」欄位解析出的上下班時間比較，容許 10 分鐘緩衝（寫在 `server/index.js` 的 `ATTENDANCE_GRACE_MINUTES` 常數，如需調整直接改這個值）；跨夜班別（例如 18:00-06:00）的早退判斷用時間字串直接比較會不準確，這是已知限制。
- Dashboard 的「平均出勤率」與「部門出勤率」現在也是查詢真正匯入的考勤資料計算（正常天數 ÷（正常＋缺卡天數）），沒有匯入過考勤資料時會顯示無資料或 0%。

**已知風險**：解析 `.xls` 用的 `xlsx`（SheetJS）npm 套件目前發布在 npm 官方登記所的版本有已知的高風險安全性問題（原型污染、ReDoS），且沒有官方修補版本可安裝（SheetJS 已改把修補版本另外發布在自己的 CDN，不在 npm 上）。因為這支端點限定只有 `admin`/`hr`/`manager` 角色能呼叫，風險僅限於這些受信任的內部帳號上傳的檔案，但如果貴公司的資安政策不允許使用有已知漏洞的套件，請自行評估是否要改用 SheetJS 官方 CDN 版本或其他方案。

## 請假紀錄匯入與分析

本系統的數位化「請假申請」功能是後來才上線的，正式上線前的既有請假紀錄還留在外部打卡系統裡。在「報表分析 → 請假分析」分頁可以把外部系統匯出的「請假紀錄」`.xls` 補匯進來，讓下方的請假分布圖／長條圖能反映實際的歷史用假情況。

**運作方式**：

- 跟考勤匯入一樣，靠員工的「考勤帳號」欄位比對匯入資料列對應到哪位員工，匯入前需先在「員工管理」把這個欄位填好。
- 支援的檔案格式：一列一筆請假紀錄，標題列以關鍵字辨識欄位（欄位順序可調整），需包含「人員帳號」「假別」「請假開始時間」「請假結束時間」；「請假天數」「請假時數」「請假分鐘數」三者依匯出檔實際請假單位，通常只會填其中一個。這是目前測試過的其中一種打卡系統匯出格式；如果貴公司的匯出格式標題文字不同，需要調整 `server/index.js` 的 `parseLeaveXls` 函式。
- 只有外部系統標記「已生效」狀態的紀錄才會被計入請假分布圖的統計，但所有列都會被存起來（供未來查看原始資料或狀態變更後重新匯入時更新）。
- 匯入採 UPSERT（同一位員工、同一假別、同一段起訖時間再匯入一次會覆蓋舊資料，例如狀態從「審核中」改成「已生效」），可以重複匯入同一份檔案或匯入修正後的檔案不會產生重複紀錄。
- 找不到對應「考勤帳號」的資料列不會被匯入，會在匯入結果裡列出未比對到的帳號清單，供 HR 補上員工的考勤帳號後重新匯入。
- 匯入的資料存在獨立的 `imported_leave_records` 表，**不會**寫入本系統自己的 `leave_applications`，也**不影響**假別餘額計算或核准流程；請假分析圖表是把這張表跟正式數位化請假申請的資料加總後一起統計。

## API 端點

### 登入（公開，不需 token）
- `POST /api/auth/login` — `{ username, password }`，成功回傳 `{ token, user }`
- `GET /api/health` — 健康檢查
- `GET /api/auth/microsoft/status` — 回傳 `{ enabled }`，供登入頁判斷要不要顯示「使用 Microsoft 帳號登入」按鈕
- `GET /api/auth/microsoft/login` — 導向 Microsoft 登入頁，瀏覽器整頁導航使用，不是給前端 fetch 呼叫的
- `GET /api/auth/microsoft/callback` — Microsoft 登入完成後的回呼網址（要跟 `MS_REDIRECT_URI` 完全一致），驗證成功會導回前端 `/sso-callback#token=...`，失敗則導回 `/login?ssoError=<代碼>`

以下端點皆需在 Header 帶上 `Authorization: Bearer <token>`：

- `GET /api/auth/me` — 取得目前登入的使用者
- `PUT /api/auth/change-password` — `{ currentPassword, newPassword }`，任何登入者皆可自行修改密碼，需先驗證目前密碼正確

### 系統設定（僅 admin）
- `GET /api/settings/notifications` — 取得目前通知設定，密碼/金鑰類欄位只回傳是否已設定（`hasSmtpPassword` 等布林值），不回傳明文
- `PUT /api/settings/notifications` — 更新通知設定；密碼/金鑰類欄位留空表示不變更，非空字串才會覆蓋
- `POST /api/settings/notifications/test` — 用目前已儲存的設定發送一則測試通知

### 部門管理（僅 HR/主管）
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/:id`
- `DELETE /api/departments/:id`

### 員工管理（僅 HR/主管）
- `GET /api/employees`
- `POST /api/employees` — 新增員工時會自動建立對應的員工登入帳號與第一期特休週年紀錄；可選帶 `initialAnnualLeaveUsed`，登記系統上線前該員工已休掉的特休天數（預設 0）
- `POST /api/employees/import` — `{ csv }` 批次匯入，標題列需含姓名/員工編號/部門/職位/電子郵件/到職日（電話/地址/備註/月薪/性別/考勤帳號/已用特休天數選填，欄位可任意排序；性別填「男」或「女」，用於限制生理假等性別限定的假別；考勤帳號用於比對外部打卡系統匯入的考勤資料），逐列處理、單列失敗不影響其他列，回傳 `{ created, failed: [{ row, employeeId, error }] }`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `PUT /api/employees/:id/terminate` — 員工離職時會一併停用其登入帳號
- `POST /api/employees/:id/reset-password` — 將該員工登入密碼重設為預設值（＝員工編號），無帳號時會一併建立

### 假別管理
- `GET /api/leave-types` — 所有登入者皆可查詢
- `POST /api/leave-types`（僅 HR/主管）
- `GET /api/leave-applications` — 員工只會看到自己的申請，HR/主管看到全公司
- `POST /api/leave-applications` — 員工角色送出時會強制以自己的 employeeId 覆蓋，無法代他人申請；假別為「補休」時以 `startTime`/`endTime`（需同一天）精確計算小時數並自動扣除中午 12:00–13:00 午休時段，其餘假別仍以 `startDate`/`endDate` 計算日曆天數；假別為「生理假」時，若該員工性別為男性會回傳 400（性別未填寫則不擋）
- `POST /api/leave-applications/:id/attachment` — 上傳證明文件（`multipart/form-data`，欄位名 `file`，僅接受 JPG/PNG/WEBP/PDF，5MB 以內），本人或 HR/主管可上傳，重複上傳會覆蓋舊檔
- `GET /api/leave-applications/:id/attachment` — 下載證明文件，本人或 HR/主管可下載
- `PUT /api/leave-applications/:id/status`（僅 HR/主管審核）— `{ status, approver, days, reviewNote }`，`days` 可選，用於核准時依證明文件調整實際核准天數（例如喪假依親屬關係核定 3/6/8 天），不帶則沿用申請時的天數；`reviewNote` 可選，核准或拒絕都可填寫審核備註，員工自助頁看得到
- `GET /api/leave-balances` — 員工只會看到自己的餘額；特休、補休皆為即時計算欄位（特休來自 `leave_periods`，補休來自 `comp_time_grants`），僅病假可手動調整
- `PUT /api/leave-balances/:employeeId`（僅 HR/主管）— `{ sickLeave, sickLeaveUsed }`，只能調整病假，特休/補休請分別透過「特休結算」與加班核准/補休請假調整
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
- `POST /api/overtime-applications` — `{ employeeId, date, startTime, endTime, reason, compensationType }`，`compensationType` 為 `pay`（領加班費，預設）或 `comp`（換補休）；時數與換算後的補休時數自動計算，並依 `holidays` 表自動標記是否為假日加班；員工角色送出時會強制以自己的 employeeId 覆蓋
- `PUT /api/overtime-applications/:id/status`（僅 HR/主管審核）— `{ status, approver, reviewNote }`，`reviewNote` 可選，核准或拒絕都可填寫審核備註；選擇換補休的申請核准時會自動開立補休額度，補休已被使用後無法取消核准

### 補休額度
- `GET /api/comp-time-grants?employeeId=EMP001` — 查詢補休額度明細（員工只能看自己的，不帶 employeeId 時 HR/主管看全公司）
- `GET /api/comp-time-grants/expiring-soon?days=30`（僅 HR/主管）— 還沒到期但即將到期（預設 30 天內）、還有剩餘時數的補休額度清單，供提前提醒
- `GET /api/comp-time-grants/pending-settlement`（僅 HR/主管）— 已逾期但還有剩餘時數、尚未結算的補休額度清單
- `POST /api/comp-time-grants/:id/settle`（僅 HR/主管）— 結算一筆逾期補休額度，剩餘時數全數折算加班費，回傳折算時數與金額（依員工月薪試算，未設定月薪則為 `null`）

### 考勤（僅 HR/主管）
- `POST /api/attendance/import` — `multipart/form-data`，欄位 `file`（.xls）與 `year`（西元年，數字），依員工的「考勤帳號」比對匯入，回傳 `{ message, imported, unmatchedAccounts }`
- `GET /api/attendance/summary?year=2026&month=7` — 該年月每位員工的統計摘要（正常/缺卡/休息/請假天數、遲到早退次數）
- `GET /api/attendance/records?year=2026&month=7&employeeId=EMP001` — 該年月的考勤明細，可選 employeeId 篩選單一員工

### 請假紀錄匯入（僅 HR/主管）
- `POST /api/leaves/import` — `multipart/form-data`，欄位 `file`（.xls），依員工的「考勤帳號」比對匯入，寫入 `imported_leave_records`（不影響 `leave_applications`），回傳 `{ message, imported, unmatchedAccounts }`

### Dashboard（僅 HR/主管）
- `GET /api/dashboard/stats` — `pendingRequests` 同時計入待審核的請假與加班申請；另附 `pendingLeaveRequests`/`pendingOvertimeRequests` 細項，供前端判斷儀表板「待審核申請」卡片該導向哪個分頁
- `GET /api/dashboard/attendance?startDate=2026-07-01&endDate=2026-07-31`（不帶日期參數預設當月）
- `GET /api/dashboard/leaves?startDate=2026-07-01&endDate=2026-07-31`（不帶日期參數預設當月；統計同時包含正式請假申請與已生效的匯入請假紀錄）
