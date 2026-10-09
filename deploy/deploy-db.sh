#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
: "${DB_PASSWORD:?Define DB_PASSWORD}" "${DB_NAME:?Define DB_NAME}" "${DB_USER:?Define DB_USER}" "${VPC_CIDR:?Define VPC_CIDR}"
identifier "$DB_NAME"; identifier "$DB_USER"
python3 -c 'import ipaddress,sys; n=ipaddress.ip_network(sys.argv[1],strict=True); assert n.version == 4' "$VPC_CIDR"
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-client
sudo systemctl enable --now postgresql
CONF=$(sudo -u postgres psql -Atqc 'SHOW config_file')
HBA=$(sudo -u postgres psql -Atqc 'SHOW hba_file')
sudo sed -i -E "s/^#?[[:space:]]*listen_addresses[[:space:]]*=.*/listen_addresses = '*'/" "$CONF"
RULE="host $DB_NAME $DB_USER $VPC_CIDR scram-sha-256"
sudo grep -Fxq "$RULE" "$HBA" || printf '%s\n' "$RULE" | sudo tee -a "$HBA" >/dev/null
# Encode the password before placing it in SQL; secrets travel through stdin.
PASSWORD_HEX=$(printf %s "$DB_PASSWORD" | od -An -v -tx1 | tr -d ' \n')
{ printf "SELECT convert_from(decode('%s','hex'),'UTF8') AS app_password \\gset\n" "$PASSWORD_HEX"; cat <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'app_user') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'app_user') \gexec
SET password_encryption='scram-sha-256';
SELECT format('ALTER ROLE %I PASSWORD %L', :'app_user', :'app_password') \gexec
SELECT format('CREATE DATABASE %I', :'app_db') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname=:'app_db') \gexec
SQL
} | sudo -u postgres psql -v ON_ERROR_STOP=1 -v app_user="$DB_USER" -v app_db="$DB_NAME"
sudo -u postgres psql -v ON_ERROR_STOP=1 --single-transaction -d "$DB_NAME" -f deploy/schema.sql
if [[ -f deploy/initial-data.sql ]]; then
  HAS_DATA=$(sudo -u postgres psql -At -v ON_ERROR_STOP=1 -d "$DB_NAME" -c 'SELECT EXISTS(SELECT 1 FROM users) OR EXISTS(SELECT 1 FROM products)')
  if [[ "$HAS_DATA" == f ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 --single-transaction -d "$DB_NAME" -f deploy/initial-data.sql
    echo 'Datos originales importados.'
  else
    echo 'La base ya contiene datos; se conserva su contenido y se omite la importación.'
  fi
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -v app_user="$DB_USER" <<'SQL'
GRANT CONNECT ON DATABASE :"DBNAME" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SQL
sudo systemctl restart postgresql
sudo -u postgres psql -d "$DB_NAME" -c '\dt'
