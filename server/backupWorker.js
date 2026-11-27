// 備份服務（docker compose 的 backup）：資料庫（mariadb-dump）＋請假附件，存到 /backups，
// 並依「系統設定」把備份複製到 NAS 的 SMB 資料夾。
//   node backupWorker.js        常駐：每天 BACKUP_TIME 備份一次；啟動時若 24 小時內沒有備份會先做一次
//   node backupWorker.js now    立刻備份（含上傳）一次

import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import mysql from 'mysql2/promise';
import { ensureBackupSchema, readBackupRow, BACKUP_TIME, BACKUP_KEEP_DAYS } from './backupSettings.js';
import { testSmb, syncToSmb, BACKUP_FILE_RE } from './backupSmb.js';
import { sendNotification } from './notifications.js';

process.umask(0o077);
const DIR = process.env.BACKUP_DIR_IN_CONTAINER || '/backups';
const UPLOADS = process.env.UPLOADS_DIR || '/app/uploads';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db', port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  dateStrings: true, connectionLimit: 3,
});

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const stamp = (d) => `${dateStr(d).replace(/-/g, '')}-${timeStr(d).replace(':', '')}${pad(d.getSeconds())}`;
const log = (message) => console.log(`[backup] ${dateStr(new Date())} ${new Date().toTimeString().slice(0, 8)} ${message}`);

const exited = (child, name) => new Promise((resolve, reject) => {
  let stderr = '';
  child.stderr.on('data', (c) => { stderr = (stderr + c).slice(-500); });
  child.on('error', reject);
  child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${name} 失敗（${code}）：${stderr.trim()}`))));
});

async function dumpDatabase(file) {
  const child = spawn('mariadb-dump', [
    '-h', process.env.DB_HOST || 'db', '-P', String(process.env.DB_PORT || 3306), '-uroot', '--skip-ssl',
    '--single-transaction', '--routines', '--triggers', '--events', process.env.DB_NAME,
  ], { env: { ...process.env, MYSQL_PWD: process.env.MARIADB_ROOT_PASSWORD } });
  let tail = '';
  const keepTail = new Transform({ transform(chunk, _enc, done) { tail = (tail + chunk).slice(-300); done(null, chunk); } });
  await Promise.all([exited(child, 'mariadb-dump'), pipeline(child.stdout, keepTail, createGzip(), createWriteStream(file))]);
  if (!tail.includes('Dump completed')) throw new Error('資料庫匯出不完整');
}

// 先寫到 .tmp，確認完整才改成正式檔名，避免半成品被當成可用的備份
async function createLocalBackup() {
  await fs.mkdir(DIR, { recursive: true });
  await fs.chmod(DIR, 0o700).catch(() => {});
  const id = stamp(new Date());
  const db = path.join(DIR, `db-${id}.sql.gz`);
  const files = path.join(DIR, `uploads-${id}.tar.gz`);
  try {
    await dumpDatabase(`${db}.tmp`);
    await fs.rename(`${db}.tmp`, db);
    await exited(spawn('tar', ['-czf', `${files}.tmp`, '-C', UPLOADS, '.']), 'tar');
    await exited(spawn('gzip', ['-t', `${files}.tmp`]), '附件備份檢查');
    await fs.rename(`${files}.tmp`, files);
  } finally {
    await fs.rm(`${db}.tmp`, { force: true });
    await fs.rm(`${files}.tmp`, { force: true });
  }
  // 只有這次備份成功才清舊檔，備份連續失敗時不會把僅存的好備份刪掉
  const cutoff = Date.now() - BACKUP_KEEP_DAYS * 86400000;
  for (const name of await fs.readdir(DIR)) {
    if (BACKUP_FILE_RE.test(name) && (await fs.stat(path.join(DIR, name))).mtimeMs < cutoff) await fs.rm(path.join(DIR, name));
  }
  const size = (await fs.stat(db)).size;
  return `${path.basename(db)}（${Math.ceil(size / 1024)} KB）與附件備份完成`;
}

async function record(kind, ok, message) {
  await pool.execute(
    `UPDATE backup_settings SET last${kind}At = NOW(), last${kind}Ok = ?, last${kind}Message = ? WHERE id = 1`,
    [ok, String(message).slice(0, 500)]
  ).catch((error) => log(`寫入狀態失敗：${error.message}`));
}

async function runBackup() {
  let ok = true;
  try {
    const message = await createLocalBackup();
    log(message);
    await record('Backup', true, message);
  } catch (error) {
    ok = false;
    log(`錯誤：本機備份失敗：${error.message}`);
    await record('Backup', false, error.message);
    await sendNotification(pool, '備份失敗', `HR 系統本機備份失敗：${error.message}`);
  }

  // 本機這次失敗仍嘗試上傳，讓先前還沒傳成功的備份補上去
  const row = await readBackupRow(pool).catch(() => null);
  if (row?.smbEnabled) {
    try {
      const message = await syncToSmb(DIR, row);
      log(`SMB：${message}`);
      await record('Upload', true, message);
    } catch (error) {
      ok = false;
      log(`錯誤：上傳到 SMB 失敗：${error.message}`);
      await record('Upload', false, error.message);
      await sendNotification(pool, '備份上傳失敗', `HR 系統備份上傳到 NAS 失敗：${error.message}\n本機備份仍保留在主機上。`);
    }
  }
  return ok;
}

async function handleRequest() {
  const row = await readBackupRow(pool);
  if (!row?.requestedAction) return;
  try {
    if (row.requestedAction === 'test') {
      try {
        const message = await testSmb(row);
        log(`SMB 測試：${message}`);
        await record('Test', true, message);
      } catch (error) {
        log(`SMB 測試失敗：${error.message}`);
        await record('Test', false, error.message);
      }
    } else {
      await runBackup();
    }
  } finally {
    await pool.execute('UPDATE backup_settings SET requestedAction = NULL, requestedAt = NULL WHERE id = 1');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 後端啟動時會建立新的資料表，等它就緒再做第一次備份
async function waitForBackend() {
  const url = process.env.BACKEND_HEALTH_URL || 'http://backend:3001/api/health';
  for (let i = 0; i < 60; i += 1) {
    if (await fetch(url, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok).catch(() => false)) return;
    await sleep(2000);
  }
  log('後端未就緒，仍繼續執行備份');
}

async function hasRecentBackup() {
  const names = await fs.readdir(DIR).catch(() => []);
  for (const name of names) {
    if (name.startsWith('db-') && BACKUP_FILE_RE.test(name) && Date.now() - (await fs.stat(path.join(DIR, name))).mtimeMs < 86400000) return true;
  }
  return false;
}

async function main() {
  await ensureBackupSchema(pool);
  if (process.argv[2] === 'now') {
    const ok = await runBackup();
    await pool.end();
    process.exit(ok ? 0 : 1);
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(BACKUP_TIME)) throw new Error(`BACKUP_TIME 格式不正確（需 HH:MM）：${BACKUP_TIME}`);
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => process.exit(0));

  const beat = () => pool.execute('UPDATE backup_settings SET heartbeatAt = NOW() WHERE id = 1').catch(() => {});
  await beat();
  setInterval(beat, 20000);
  log(`啟動：每天 ${BACKUP_TIME} 備份，本機保留 ${BACKUP_KEEP_DAYS} 天`);

  await waitForBackend();
  const start = new Date();
  let scheduledFor = timeStr(start) >= BACKUP_TIME ? dateStr(start) : null; // 今天的時間已過就從明天開始
  if (!(await hasRecentBackup())) await runBackup();

  for (;;) {
    try {
      await handleRequest();
      const now = new Date();
      if (timeStr(now) >= BACKUP_TIME && scheduledFor !== dateStr(now)) {
        scheduledFor = dateStr(now);
        await runBackup();
      }
    } catch (error) {
      log(`錯誤：${error.message}`);
    }
    await sleep(5000);
  }
}

main().catch((error) => { log(`服務無法啟動：${error.message}`); process.exit(1); });
