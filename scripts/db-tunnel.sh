#!/bin/bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

SSH_HOST="${ELFANT_SSH_HOST:-kaj@__SSH_HOST__}"
NAMESPACE="${ELFANT_K8S_NAMESPACE:-database}"
SERVICE="${ELFANT_DB_SERVICE:-postgres}"
LOCAL_PORT="${ELFANT_DB_LOCAL_PORT:-5432}"
REMOTE_PORT="${ELFANT_DB_REMOTE_PORT:-5432}"

export SSHPASS="${ELFANT_SSH_PASSWORD:?Set ELFANT_SSH_PASSWORD in .env}"

echo "→ Tunnelling $NAMESPACE/$SERVICE to localhost:$LOCAL_PORT via $SSH_HOST ..."
sshpass -e ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 \
  -L "$LOCAL_PORT:localhost:$REMOTE_PORT" \
  "$SSH_HOST" \
  kubectl port-forward -n "$NAMESPACE" "svc/$SERVICE" "$REMOTE_PORT:$REMOTE_PORT"
