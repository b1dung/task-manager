#!/bin/sh
set -eu

backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$backup_dir/taskboard-$timestamp.dump"

: "${DATABASE_URL:?DATABASE_URL is required}"
pg_dump --format=custom --no-owner --no-acl --file="$output" "$DATABASE_URL"
sha256sum "$output" > "$output.sha256"
find "$backup_dir" -type f -mtime "+${BACKUP_RETENTION_DAYS:-30}" -delete
echo "$output"
