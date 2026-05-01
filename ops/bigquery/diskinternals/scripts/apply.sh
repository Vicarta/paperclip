#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE_DIR="$ROOT_DIR/bigquery/diskinternals"

PROJECT_ID="${GCP_PROJECT_ID:-}"
DATASET="${BQ_DATASET:-diskinternals_growth}"
LOCATION="${BQ_LOCATION:-US}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --dataset) DATASET="$2"; shift 2 ;;
    --location) LOCATION="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "GCP project is required via GCP_PROJECT_ID or --project" >&2
  exit 2
fi

command -v bq >/dev/null 2>&1 || {
  echo "bq CLI is required for ops/bootstrap" >&2
  exit 2
}

bq --location="$LOCATION" mk --dataset --if_not_exists "$PROJECT_ID:$DATASET"

for sql_file in "$BASE_DIR"/schema/*.sql "$BASE_DIR"/views/*.sql; do
  tmp="$(mktemp)"
  sed \
    -e "s/__PROJECT__/$PROJECT_ID/g" \
    -e "s/__DATASET__/$DATASET/g" \
    "$sql_file" > "$tmp"
  bq --location="$LOCATION" query --use_legacy_sql=false < "$tmp"
  rm -f "$tmp"
done

echo "Applied DiskInternals BigQuery growth schema to $PROJECT_ID:$DATASET ($LOCATION)"
