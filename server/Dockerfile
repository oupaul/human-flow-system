FROM node:20-alpine

# 時區資料：容器以台北時間運作（打卡與出勤日期判斷依此）
# mariadb-client、samba-client：備份服務（backupWorker.js）匯出資料庫與上傳到 NAS 用
RUN apk add --no-cache tzdata mariadb-client samba-client

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "node auto-seed-admin.js; node index.js"]
