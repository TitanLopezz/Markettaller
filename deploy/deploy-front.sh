#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
BACKEND_IP=${1:?Uso: bash deploy/deploy-front.sh IP_PRIVADA_BACKEND}
ipv4 "$BACKEND_IP"
test -f dist/index.html
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
sed "s/__BACKEND_IP__/$BACKEND_IP/g" deploy/nginx.conf.template | sudo tee /etc/nginx/sites-available/default >/dev/null
sudo nginx -t
# Fixed deployment directory only; never delete a caller-supplied path.
sudo mkdir -p /var/www/app
sudo find /var/www/app -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
sudo cp -R dist/. /var/www/app/
sudo chmod -R a+rX /var/www/app
sudo systemctl enable nginx
sudo systemctl restart nginx
