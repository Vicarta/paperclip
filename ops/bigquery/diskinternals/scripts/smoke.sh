#!/usr/bin/env bash
set -euo pipefail

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

bq --location="$LOCATION" query --use_legacy_sql=false --dry_run \
  "SELECT url_id, normalized_url FROM \`$PROJECT_ID.$DATASET.report_site_url_inventory\` LIMIT 10"

bq --location="$LOCATION" query --use_legacy_sql=false --dry_run \
  "SELECT opportunity_id, page_action_score FROM \`$PROJECT_ID.$DATASET.mart_growth_opportunities\` LIMIT 10"

echo "DiskInternals BigQuery growth smoke passed for $PROJECT_ID:$DATASET ($LOCATION)"
