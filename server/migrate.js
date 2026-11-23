// 啟動時自動套用 server/migrations 裡尚未套用的遷移檔。
//   * schema.sql 只在「資料庫第一次建立」時執行；舊主機更新程式後缺的資料表／欄位由這裡補上
//   * 已套用的檔名記在 schema_migrations；舊主機第一次啟動會把全部檔案各跑一次，
//     遇到「已存在」類的錯誤（資料表、欄位、索引、外鍵已存在）視為該語句早已套用而略過
//   * 在這種「早已套用」的檔案裡，不再執行 UPDATE／DELETE，避免重複改到現有資料
//   * 某個檔案出現其他錯誤時，記錄後停在該檔案（下次啟動會重試），不會讓伺服器起不來
import fs from 'node:fs';
import path from 'node:path';

// 資料表／欄位／索引／主鍵／外鍵已存在，或要刪除的物件本來就不存在
const IGNORABLE_ON_ANY = new Set([1050, 1060, 1061, 1022, 1068, 1826, 1091]);

export function splitStatements(sql) {
  const noComments = sql.split('\n').map((line) => line.replace(/(^|\s)--.*$/, '')).join('\n');
  return noComments.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
}

export async function runMigrations(pool, dir) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    appliedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  const [done] = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(done.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  const result = { applied: [], failed: null };

  for (const file of files) {
    if (applied.has(file)) continue;
    const statements = splitStatements(fs.readFileSync(path.join(dir, file), 'utf8'));
    let alreadyApplied = false;
    let failed = false;
    for (const statement of statements) {
      if (alreadyApplied && /^(UPDATE|DELETE)\b/i.test(statement)) continue;
      try {
        await pool.query(statement);
      } catch (error) {
        if (IGNORABLE_ON_ANY.has(error.errno)) { alreadyApplied = true; continue; }
        console.error(`資料庫遷移 ${file} 失敗：${error.message}\n  語句：${statement.slice(0, 120)}`);
        result.failed = file;
        failed = true;
        break;
      }
    }
    if (failed) break;
    await pool.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', [file]);
    result.applied.push(file);
  }
  if (result.applied.length) console.log(`資料庫遷移完成：${result.applied.join(', ')}`);
  return result;
}
