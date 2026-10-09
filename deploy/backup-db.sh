#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
: "${DB_NAME:?Define DB_NAME}"
identifier "$DB_NAME"
umask 077
mkdir -p backups
BACKUP="backups/${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ)-$$.sql.gz"
sudo mysqldump --single-transaction --no-tablespaces "$DB_NAME" | gzip > "$BACKUP"
test -s "$BACKUP"
gzip -t "$BACKUP"
echo "Copia creada: $BACKUP. Descárgala fuera del laboratorio para conservarla."
