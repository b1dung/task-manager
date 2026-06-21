#!/bin/sh
set -eu

: "${1:?Usage: verify-backup.sh backup.dump}"
backup="$1"
test -f "$backup"
if test -f "$backup.sha256"; then sha256sum -c "$backup.sha256"; fi
pg_restore --list "$backup" >/dev/null
echo "Backup archive is readable: $backup"
