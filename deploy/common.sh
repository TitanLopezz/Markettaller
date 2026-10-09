#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source /etc/os-release
[[ "$ID" == ubuntu ]] || { echo 'Se requiere Ubuntu'; exit 1; }
if [[ "$VERSION_ID" != 24.04 ]]; then
  if [[ "$VERSION_ID" == 26.04 && "$(basename "${BASH_SOURCE[1]}")" == deploy-back.sh ]]; then
    echo 'Backend en Ubuntu 26.04: compatibilidad pendiente de validación en EC2.'
  else
    echo 'Este script requiere Ubuntu 24.04; solo el backend permite también 26.04.'
    exit 1
  fi
fi
ipv4() { python3 -c 'import ipaddress,sys; assert ipaddress.ip_address(sys.argv[1]).version == 4' "$1"; }
identifier() { [[ "$1" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]] || { echo 'Identificador inválido'; exit 1; }; }
