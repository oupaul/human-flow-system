# Human Flow System（人事管理系統）

一套以正體中文為介面的人事管理系統，涵蓋員工/部門管理、請假與加班申請審核、特休週年結算、補休、國定假日行事曆、系統通知（Email/Teams）等功能。前端為 Vite + React + TypeScript + shadcn/ui，後端為 Express + MariaDB，以 Docker Compose 部署。

## 功能總覽

- **員工與部門管理**：員工資料維護、CSV 批次匯入、離職停用、密碼重設
- **請假申請與審核**：核准/拒絕皆可填寫審核備註，證明文件上傳
- **特休（週年制）**：依到職日與勞基法第 38 條年資級距自動計算，週年到期由 HR 手動結算（可選遞延一次或折現）
- **假別核給**：喪假、婚假等「同一事由分次請假」的假別，由 HR 核給總天數與應休畢期限
- **加班與補休**：加班申請可選擇領加班費或換補休（依勞基法第 32-1 條 1:1 換算），補休逾期未休會由 HR 結算折算加班費
- **國定假日行事曆**：可匯入政府行政機關辦公日曆表 CSV
- **系統通知**：新申請送出時可通知 HR/主管，支援 SMTP（含 OAuth2）或 Microsoft Teams Webhook，於「系統設定」頁面（僅 admin）管理
- **角色權限**：admin／hr／manager／employee 四種角色，員工僅能看到與操作自己的資料
- **儀表板**：待審核件數、部門出勤率等統計，卡片可直接點擊導向對應功能頁面

## 技術架構

- 前端：Vite、React、TypeScript、shadcn/ui（Radix）、Tailwind CSS
- 後端：Node.js、Express、mysql2（MariaDB / MySQL）、JWT 登入驗證
- 部署：Docker Compose（frontend / backend / db 三個容器）

## 部署與更新

**正式環境請使用 Docker 部署**，完整步驟（含環境變數設定、建置啟動、既有部署升級要套用哪些 migration、健康檢查測試）請見 **[DEPLOY.md](DEPLOY.md)**。

日常更新既有部署的流程簡述：

```sh
git pull
docker compose up --build -d
# 若這次更新有新增資料庫異動，DEPLOY.md「既有部署升級」章節會列出對應要套用的 migration 檔
```

不使用 Docker、想手動安裝資料庫與後端，或需要查 API 端點清單、角色權限、特休/補休運作邏輯與系統通知設定方式，請見 **[API_SETUP_README.md](API_SETUP_README.md)**。

## 本機前端開發

只啟動前端做畫面開發時（API 呼叫需搭配已在跑的後端，可用 Docker 啟動的後端或依 API_SETUP_README.md 手動啟動）：

```sh
npm install
npm run dev
```

## 授權

僅供內部使用。
