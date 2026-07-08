#!/bin/bash
set -euo pipefail

NAMESPACE="${ELFANT_K8S_NAMESPACE:-database}"
SRC_DB="${ELFANT_SRC_DB:-elfant}"
DST_DB="${ELFANT_DST_DB:-dev_elfant}"

echo "→ Copying $SRC_DB -> $DST_DB on $NAMESPACE/postgres ..."
kubectl exec -n "$NAMESPACE" postgres-0 -- pg_dump -U postgres -d "$SRC_DB" \
  | kubectl exec -n "$NAMESPACE" -i postgres-0 -- psql -U postgres -d "$DST_DB"
echo "Done."
