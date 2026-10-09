#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
DOMAIN=${1:?Uso: bash deploy/enable-https.sh dominio email}
EMAIL=${2:?Indica el email para avisos del certificado}
[[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]] || { echo 'Dominio inválido'; exit 1; }
[[ "$EMAIL" == *@*.* ]] || { echo 'Email inválido'; exit 1; }
echo 'El dominio debe apuntar a esta instancia y los puertos 80 y 443 deben estar abiertos.'
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
sudo sed -i -E "s/^([[:space:]]*)server_name[[:space:]]+[^;]+;/\1server_name $DOMAIN;/" /etc/nginx/sites-available/default
sudo nginx -t
sudo certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --redirect
sudo nginx -t
sudo systemctl reload nginx
echo 'Actualiza FRONTEND_ORIGIN=https://tu-dominio en el backend y repite deploy-back.sh.'
