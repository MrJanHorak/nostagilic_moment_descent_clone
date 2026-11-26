#!/bin/bash
# DESCENDED game server: Compute Engine startup script (runs as root on every boot).
# Installs Node and Caddy once, then fetches the latest code from GitHub, installs
# the runtime dependency and (re)starts the server behind Caddy, which serves
# wss:// with an automatic Let's Encrypt certificate.
#
# Settings come from instance metadata (see deploy/gcp/README.md):
#   repo           git URL to deploy (default: the public GitHub repository)
#   branch         branch to deploy (default: main)
#   allow-origins  comma-separated sites allowed to connect (default: the Netlify site)
#   domain         host name for the certificate (default: <external-ip>.sslip.io)
set -euo pipefail

meta() { curl -sf -H 'Metadata-Flavor: Google' "http://metadata.google.internal/computeMetadata/v1/$1" || true; }
REPO=$(meta instance/attributes/repo); REPO=${REPO:-https://github.com/MrJanHorak/nostagilic_moment_descent_clone.git}
BRANCH=$(meta instance/attributes/branch); BRANCH=${BRANCH:-main}
ORIGINS=$(meta instance/attributes/allow-origins); ORIGINS=${ORIGINS:-https://aishootergame.netlify.app}
IP=$(meta instance/network-interfaces/0/access-configs/0/external-ip)
DOMAIN=$(meta instance/attributes/domain); DOMAIN=${DOMAIN:-${IP//./-}.sslip.io}
APP=/opt/descended

# A 1 GB e2-micro is happier with a little swap during npm installs.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Node 24 (the version the project declares) and Caddy, installed once.
if ! command -v node >/dev/null || ! node -v | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs git
fi
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi

# Latest code. Only `three` is needed at runtime (dev tools are skipped).
id descended >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin descended
if [ -d "$APP/.git" ]; then git -C "$APP" fetch --depth 1 origin "$BRANCH" && git -C "$APP" reset --hard "origin/$BRANCH"
else git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP"; fi
cd "$APP" && npm ci --omit=dev --no-audit --no-fund --engine-strict=false
chown -R descended:descended "$APP"

# The game server listens only on localhost; Caddy is the public face.
cat > /etc/systemd/system/descended.service <<UNIT
[Unit]
Description=DESCENDED game server
After=network-online.target
Wants=network-online.target

[Service]
User=descended
WorkingDirectory=$APP
Environment=NODE_ENV=production PORT=8787 HOST=127.0.0.1 ALLOW_ORIGINS=$ORIGINS DATA_DIR=/var/lib/descended
ExecStart=/usr/bin/node server/index.mjs
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
StateDirectory=descended
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
  reverse_proxy 127.0.0.1:8787
}
CADDY

systemctl daemon-reload
systemctl enable descended caddy
systemctl restart descended caddy
echo "DESCENDED game server: wss://$DOMAIN/play (health: https://$DOMAIN/health), origins: $ORIGINS"
