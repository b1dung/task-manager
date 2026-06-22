#!/bin/sh
set -eu

: "${1:?Usage: verify-backup.sh backup.sql.gz}"
backup="$1"
test -f "$backup"
if test -f "$backup.sha256"; then sha256sum -c "$backup.sha256"; fi
gzip -t "$backup"
gzip -cd "$backup" | sed -n '1,20p' | grep -Eq 'MySQL dump|MariaDB dump'
echo "Backup archive is readable: $backup"
