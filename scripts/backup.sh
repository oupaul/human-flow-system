#!/usr/bin/env bash
# 每日自動備份：資料庫（mariadb-dump）＋請假附件（uploads）。由 docker-compose 的 backup 服務執行。
#   bash /backup.sh        常駐：每天 BACKUP_TIME 備份一次；啟動時若 24 小時內沒有備份會先做一次
#   bash /backup.sh now    立刻備份一次
set -uo pipefail
umask 077

DIR="${BACKUP_DIR_IN_CONTAINER:-/backups}"
AT="${BACKUP_TIME:-02:30}"
KEEP="${BACKUP_KEEP_DAYS:-30}"

log() { echo "[backup] $(date '+%F %T') $*"; }

run_backup() {
  local stamp db files
  stamp="$(date +%Y%m%d-%H%M%S)"
  db="$DIR/db-$stamp.sql.gz"
  files="$DIR/uploads-$stamp.tar.gz"

  # 先寫到 .tmp，確認完整才改成正式檔名，避免半成品被當成可用的備份
  if MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb-dump -h "${DB_HOST:-db}" -uroot \
        --single-transaction --routines --triggers --events "$DB_NAME" | gzip > "$db.tmp" \
      && gzip -dc "$db.tmp" | tail -n 3 | grep -q "Dump completed"; then
    mv "$db.tmp" "$db"
    log "資料庫備份完成：$(basename "$db")（$(du -h "$db" | cut -f1)）"
  else
    rm -f "$db.tmp"
    log "錯誤：資料庫備份失敗"
    return 1
  fi

  if tar -czf "$files.tmp" -C /uploads . && gzip -t "$files.tmp"; then
    mv "$files.tmp" "$files"
    log "附件備份完成：$(basename "$files")（$(du -h "$files" | cut -f1)）"
  else
    rm -f "$files.tmp"
    log "錯誤：附件備份失敗"
    return 1
  fi

  # 只有這次備份成功才清舊檔，備份連續失敗時不會把僅存的好備份刪掉
  find "$DIR" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP" -delete
}

chmod 700 "$DIR" 2>/dev/null || true

if [ "${1:-}" = "now" ]; then
  run_backup
  exit $?
fi

trap 'exit 0' TERM INT
log "啟動：每天 $AT 備份，保留 $KEEP 天"
if [ -z "$(find "$DIR" -maxdepth 1 -name 'db-*.sql.gz' -mmin -1440 2>/dev/null)" ]; then
  run_backup || true
fi

while true; do
  next="$(date -d "today $AT" +%s)" || { log "錯誤：BACKUP_TIME 格式不正確（需 HH:MM）：$AT"; exit 1; }
  if [ "$next" -le "$(date +%s)" ]; then next="$(date -d "tomorrow $AT" +%s)"; fi
  sleep $((next - $(date +%s))) &
  wait $!
  run_backup || true
done
