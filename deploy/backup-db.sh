#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
: "${DB_NAME:?Define DB_NAME}"
identifier "$DB_NAME"
umask 077
mkdir -p backups
BACKUP="backups/${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
sudo -u postgres pg_dump -Fc "$DB_NAME" > "$BACKUP"
pg_restore --list "$BACKUP" >/dev/null
echo "Copia creada: $BACKUP. Descárgala fuera del laboratorio."
