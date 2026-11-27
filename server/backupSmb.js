// 用 smbclient 把備份複製到 NAS 的 SMB 分享資料夾（使用者層級操作，主機與容器都不需要掛載網路磁碟）。

import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { normalizeSmbConfig, isSmbComplete, BackupError } from './backupSettings.js';

export const BACKUP_FILE_RE = /^(db|uploads)-(\d{4})(\d{2})(\d{2})-\d{6}\.(sql\.gz|tar\.gz)$/;
const COMMAND_TIMEOUT_MS = 15 * 60 * 1000;

const HINTS = {
  NT_STATUS_LOGON_FAILURE: '帳號或密碼錯誤',
  NT_STATUS_ACCESS_DENIED: '沒有權限，請確認這個帳號可以寫入該資料夾',
  NT_STATUS_BAD_NETWORK_NAME: '找不到分享資料夾',
  NT_STATUS_HOST_UNREACHABLE: '連不到主機',
  NT_STATUS_NETWORK_UNREACHABLE: '連不到主機',
  NT_STATUS_IO_TIMEOUT: '連線逾時',
  NT_STATUS_CONNECTION_REFUSED: '主機拒絕連線（SMB 服務可能未啟用）',
  NT_STATUS_NOT_FOUND: '找不到主機',
  NT_STATUS_UNSUCCESSFUL: '連線失敗，請確認主機位址',
  NT_STATUS_ACCOUNT_LOCKED_OUT: '帳號已被鎖定',
  NT_STATUS_PASSWORD_MUST_CHANGE: '這個帳號需要先變更密碼',
  NT_STATUS_DISK_FULL: '遠端磁碟空間不足',
};

function smbMessage(output) {
  const code = /NT_STATUS_[A-Z_]+/.exec(output)?.[0];
  if (code) return `${HINTS[code] ?? 'SMB 操作失敗'}（${code}）`;
  return output.trim().split('\n').slice(-1)[0]?.slice(0, 200) || 'SMB 操作失敗';
}

// 建立一個連線設定；密碼寫在只有自己能讀的暫存檔，不放在指令列
async function withClient(row, work) {
  const config = { ...normalizeSmbConfig(row), smbPassword: row.smbPassword };
  if (!isSmbComplete(config)) throw new BackupError('SMB 設定不完整');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smb-'));
  const authFile = path.join(dir, 'auth');
  try {
    const lines = [`username = ${config.smbUsername}`, `password = ${config.smbPassword}`];
    if (config.smbDomain) lines.push(`domain = ${config.smbDomain}`);
    await fs.writeFile(authFile, `${lines.join('\n')}\n`, { mode: 0o600 });

    const run = (command, { ignore } = {}) => new Promise((resolve, reject) => {
      execFile('smbclient', [`//${config.smbHost}/${config.smbShare}`, '-A', authFile, '-c', command],
        { timeout: COMMAND_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          const output = `${stdout}\n${stderr}`;
          if (ignore && output.includes(ignore)) return resolve(stdout);
          if (error?.killed) return reject(new BackupError('SMB 操作逾時'));
          if (error || /NT_STATUS_[A-Z_]+/.test(output)) return reject(new BackupError(smbMessage(output)));
          resolve(stdout);
        });
    });

    const segments = config.smbFolder ? config.smbFolder.split('/') : [];
    const remote = (name) => [...segments, name].join('\\');

    // 逐層建立子資料夾，已存在就略過
    for (let i = 1; i <= segments.length; i += 1) {
      await run(`mkdir "${segments.slice(0, i).join('\\')}"`, { ignore: 'NT_STATUS_OBJECT_NAME_COLLISION' });
    }

    // 回傳 Map(檔名 -> 大小)
    const list = async () => {
      const output = await run(`ls "${remote('*')}"`);
      const files = new Map();
      for (const line of output.split('\n')) {
        const m = /^\s{2}(.+?)\s+[A-Za-z]*\s+(\d+)\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/.exec(line);
        if (m) files.set(m[1], Number(m[2]));
      }
      return files;
    };

    return await work({ run, remote, list });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// 寫入一個小檔案、確認看得到、再刪掉
export async function testSmb(row) {
  return withClient(row, async ({ run, remote, list }) => {
    const name = `.hrms-test-${Date.now()}.txt`;
    const local = path.join(os.tmpdir(), name);
    await fs.writeFile(local, 'HRMS backup connection test\n');
    try {
      await run(`put "${local}" "${remote(name)}"`);
      if (!(await list()).has(name)) throw new BackupError('已寫入但看不到測試檔，請確認資料夾權限');
      await run(`del "${remote(name)}"`);
    } finally {
      await fs.rm(local, { force: true });
    }
    return '連線成功，可以寫入與刪除';
  });
}

// 遠端沒有（或大小不符）的本機備份全部補傳：NAS 停機幾天，恢復後會自動補齊。
// 上傳成功後才清掉遠端超過保留天數的備份，只會刪本系統命名格式的檔案
export async function syncToSmb(localDir, row, now = new Date()) {
  return withClient(row, async ({ run, remote, list }) => {
    const cutoff = new Date(now.getTime() - Number(row.remoteKeepDays) * 86400000);
    const dateOf = (m) => new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]), 23, 59, 59);
    const expired = (name) => { const m = BACKUP_FILE_RE.exec(name); return !!m && dateOf(m) < cutoff; };

    const localNames = (await fs.readdir(localDir)).filter((n) => BACKUP_FILE_RE.test(n) && !expired(n)).sort();
    const before = await list();
    const uploaded = [];
    for (const name of localNames) {
      const { size } = await fs.stat(path.join(localDir, name));
      if (before.get(name) === size) continue;
      const part = `${name}.part`;
      await run(`put "${path.join(localDir, name)}" "${remote(part)}"`);
      if (before.has(name)) await run(`del "${remote(name)}"`);
      await run(`rename "${remote(part)}" "${remote(name)}"`);
      uploaded.push({ name, size });
    }

    const after = await list();
    for (const { name, size } of uploaded) {
      if (after.get(name) !== size) throw new BackupError(`上傳後檔案大小不符：${name}`);
    }

    let removed = 0;
    const newestDb = [...after.keys()].filter((n) => n.startsWith('db-') && BACKUP_FILE_RE.test(n)).sort().at(-1);
    for (const name of after.keys()) {
      const leftover = name.endsWith('.part') && BACKUP_FILE_RE.test(name.slice(0, -5));
      if ((expired(name) && name !== newestDb) || leftover) {
        await run(`del "${remote(name)}"`);
        removed += 1;
      }
    }
    return `上傳 ${uploaded.length} 個檔案${removed ? `，清除 ${removed} 個過期檔案` : ''}`;
  });
}
