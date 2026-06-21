#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: restore.sh backup.dump}"

backup="$1"
test -f "$backup"
if test -f "$backup.sha256"; then sha256sum -c "$backup.sha256"; fi
if test "${CONFIRM_RESTORE:-}" != "RESTORE"; then
  echo "Set CONFIRM_RESTORE=RESTORE to replace the target database." >&2
  exit 2
fi
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$backup"
