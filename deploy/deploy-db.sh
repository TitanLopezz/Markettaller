#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
: "${DB_PASSWORD:?Define DB_PASSWORD}" "${DB_NAME:?Define DB_NAME}" "${DB_USER:?Define DB_USER}" "${VPC_CIDR:?Define VPC_CIDR}"
identifier "$DB_NAME"; identifier "$DB_USER"
DB_NETWORK=$(python3 -c 'import ipaddress,sys; n=ipaddress.ip_network(sys.argv[1],strict=True); assert n.version == 4; print(str(n.network_address)+"/"+str(n.netmask))' "$VPC_CIDR")
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
printf '[mysqld]\nbind-address = 0.0.0.0\n' | sudo tee /etc/mysql/mysql.conf.d/app.cnf >/dev/null
sudo systemctl enable mysql
sudo systemctl restart mysql
# Hex encoding keeps the password out of SQL quoting and command arguments.
PASSWORD_HEX=$(printf %s "$DB_PASSWORD" | od -An -v -tx1 | tr -d ' \n')
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @password = CONVERT(0x$PASSWORD_HEX USING utf8mb4);
SET @statement = CONCAT('CREATE USER IF NOT EXISTS ''$DB_USER''@''$DB_NETWORK'' IDENTIFIED BY ', QUOTE(@password));
PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @statement = CONCAT('ALTER USER ''$DB_USER''@''$DB_NETWORK'' IDENTIFIED BY ', QUOTE(@password));
PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_NAME\`.* TO '$DB_USER'@'$DB_NETWORK';
SQL
sudo mysql "$DB_NAME" < deploy/schema.sql
sudo mysql "$DB_NAME" -e 'SHOW TABLES;'
