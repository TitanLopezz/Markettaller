#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
DB_HOST=${1:?Uso: bash deploy/deploy-back.sh IP_PRIVADA_BD}
ipv4 "$DB_HOST"
: "${DB_PASSWORD:?Define DB_PASSWORD}" "${JWT_SECRET:?Define JWT_SECRET}" "${DB_NAME:?Define DB_NAME}" "${DB_USER:?Define DB_USER}" "${FRONTEND_ORIGIN:?Define FRONTEND_ORIGIN, por ejemplo http://IP_PUBLICA_FRONT}"
identifier "$DB_NAME"; identifier "$DB_USER"
command -v node >/dev/null || { echo 'Instala Node.js 24 LTS y npm antes de continuar'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'
npm ci --omit=dev
export DB_HOST DB_PASSWORD JWT_SECRET DB_NAME DB_USER FRONTEND_ORIGIN
export DB_PORT=3306 PORT=3000 NODE_ENV=production
export TRUST_PROXY=1
umask 077
node <<'JS'
const fs = require('node:fs');
const keys = ['DB_HOST','DB_PASSWORD','JWT_SECRET','DB_NAME','DB_USER','FRONTEND_ORIGIN','DB_PORT','PORT','NODE_ENV','TRUST_PROXY','SHIPPING_FEE_CENTS','FREE_SHIPPING_CENTS','TRANSFER_INSTRUCTIONS','RESEND_API_KEY','MAIL_FROM'];
// JSON preserves secrets containing spaces, quotes, hashes and newlines.
fs.writeFileSync('runtime-env.json', JSON.stringify(Object.fromEntries(keys.map(k=>[k,process.env[k]]))), {mode:0o600});
JS
APP_ROOT=$(pwd)
[[ "$APP_ROOT" != *' '* ]] || { echo 'Usa una carpeta sin espacios'; exit 1; }
NODE_PATH=$(command -v node)
sudo tee /etc/systemd/system/app-api.service >/dev/null <<UNIT
[Unit]
Description=API del proyecto
After=network-online.target
Wants=network-online.target
[Service]
User=$(id -un)
WorkingDirectory=$APP_ROOT
ExecStart=$NODE_PATH --require $APP_ROOT/deploy/runtime.cjs $APP_ROOT/dist/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
UMask=0077
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable app-api
sudo systemctl restart app-api
sudo systemctl --no-pager status app-api
