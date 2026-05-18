#!/usr/bin/env bash
set -euo pipefail

VM_HOST="${VM_HOST:-root@165.227.2.163}"
APP_DIR="${APP_DIR:-/opt/apps/chessquestia}"
DOMAIN="${CHESSQUESTIA_DOMAIN:-chessquestia.mteschke.com}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
KNOWN_HOSTS_FILE="${KNOWN_HOSTS_FILE:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_CMD=(ssh)
RSYNC_SSH=(ssh)

if [[ -n "$KNOWN_HOSTS_FILE" ]]; then
  SSH_CMD+=(-o "UserKnownHostsFile=$KNOWN_HOSTS_FILE")
  RSYNC_SSH+=(-o "UserKnownHostsFile=$KNOWN_HOSTS_FILE")
fi

echo "Deploying Chessquestia to $VM_HOST"
echo "Domain: $DOMAIN"

"${SSH_CMD[@]}" "$VM_HOST" "mkdir -p '$APP_DIR'"

rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude .DS_Store \
  --exclude .chessquestia-rooms.json \
  --exclude .local-chess-rooms.json \
  --exclude deploy/.env \
  -e "${RSYNC_SSH[*]}" \
  "$ROOT_DIR/" "$VM_HOST:$APP_DIR/"

"${SSH_CMD[@]}" "$VM_HOST" "set -euo pipefail
cd '$APP_DIR/deploy'
touch .env
grep -v '^CHESSQUESTIA_DOMAIN=' .env > .env.next || true
printf 'CHESSQUESTIA_DOMAIN=%s\n' '$DOMAIN' >> .env.next
if [ -n '$GOOGLE_CLIENT_ID' ]; then
  grep -v '^GOOGLE_CLIENT_ID=' .env.next > .env.tmp || true
  printf 'GOOGLE_CLIENT_ID=%s\n' '$GOOGLE_CLIENT_ID' >> .env.tmp
  mv .env.tmp .env.next
fi
if [ -n '$GOOGLE_CLIENT_SECRET' ]; then
  grep -v '^GOOGLE_CLIENT_SECRET=' .env.next > .env.tmp || true
  printf 'GOOGLE_CLIENT_SECRET=%s\n' '$GOOGLE_CLIENT_SECRET' >> .env.tmp
  mv .env.tmp .env.next
fi
mv .env.next .env
docker compose up -d --build
for i in \$(seq 1 45); do
  container_id=\$(docker compose ps -q chessquestia)
  status=\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \"\$container_id\")
  if [ \"\$status\" = healthy ]; then
    break
  fi
  if [ \"\$status\" = running ] && ! docker inspect --format '{{if .State.Health}}yes{{end}}' \"\$container_id\" | grep -q yes; then
    break
  fi
  sleep 1
done
docker compose ps
docker compose exec -T chessquestia node -e \"fetch('http://127.0.0.1:5678/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"
"

echo "Deployed: https://$DOMAIN"
