#!/bin/bash
set -euo pipefail

NAMESPACE="${ELFANT_K8S_NAMESPACE:-database}"
SERVICE="${ELFANT_DB_SERVICE:-postgres}"
LOCAL_PORT="${ELFANT_DB_LOCAL_PORT:-5432}"
REMOTE_PORT="${ELFANT_DB_REMOTE_PORT:-5432}"

echo "→ Port-forwarding $NAMESPACE/$SERVICE to localhost:$LOCAL_PORT ..."
kubectl port-forward -n "$NAMESPACE" "svc/$SERVICE" "$LOCAL_PORT:$REMOTE_PORT"
