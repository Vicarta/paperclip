#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/live-export}"

PAPERCLIP_SSH_HOST="${PAPERCLIP_SSH_HOST:-oc_hetzner_oc_user}"
PAPERCLIP_REMOTE_COMPOSE_DIR="${PAPERCLIP_REMOTE_COMPOSE_DIR:-/home/paperclip/apps/paperclip}"
PAPERCLIP_DB_SERVICE="${PAPERCLIP_DB_SERVICE:-db}"
PAPERCLIP_DB_USER="${PAPERCLIP_DB_USER:-paperclip}"
PAPERCLIP_DB_NAME="${PAPERCLIP_DB_NAME:-paperclip}"

mkdir -p "$OUT_DIR"

run_copy() {
  local filename="$1"
  local query="$2"
  local remote_cmd

  remote_cmd=$(printf "cd %q && sudo docker compose exec -T %q psql -U %q -d %q -X -v ON_ERROR_STOP=1" \
    "$PAPERCLIP_REMOTE_COMPOSE_DIR" \
    "$PAPERCLIP_DB_SERVICE" \
    "$PAPERCLIP_DB_USER" \
    "$PAPERCLIP_DB_NAME")

  ssh "$PAPERCLIP_SSH_HOST" \
    "sudo bash -lc $(printf "%q" "$remote_cmd")" \
    > "$OUT_DIR/$filename" <<SQL
COPY ($query) TO STDOUT WITH CSV HEADER;
SQL
}

run_copy "companies.csv" "
  select
    name,
    issue_prefix,
    status,
    require_board_approval_for_new_agents,
    feedback_data_sharing_enabled,
    updated_at
  from companies
  order by issue_prefix
"

run_copy "agents.csv" "
  select
    c.issue_prefix,
    a.name,
    a.role,
    coalesce(a.title, '') as title,
    a.status,
    a.adapter_type,
    coalesce(a.runtime_config -> 'heartbeat' ->> 'enabled', '') as heartbeat_enabled,
    coalesce(a.runtime_config -> 'heartbeat' ->> 'intervalSec', '') as heartbeat_interval_sec,
    coalesce(a.runtime_config -> 'heartbeat' ->> 'wakeOnDemand', '') as heartbeat_wake_on_demand,
    coalesce(a.runtime_config -> 'heartbeat' ->> 'skipIfNoActionableWork', '') as heartbeat_skip_if_no_actionable_work,
    a.budget_monthly_cents,
    a.updated_at
  from agents a
  join companies c on c.id = a.company_id
  order by c.issue_prefix, a.name
"

run_copy "plugins.csv" "
  select
    plugin_key,
    package_name,
    version,
    status,
    coalesce(install_order::text, '') as install_order,
    coalesce(package_path, '') as package_path,
    coalesce(last_error, '') as last_error,
    updated_at
  from plugins
  order by install_order nulls last, plugin_key
"

run_copy "plugin_config_keys.csv" "
  select
    p.plugin_key,
    array_to_string(array(select jsonb_object_keys(pc.config_json) order by 1), ',') as config_keys,
    coalesce(pc.last_error, '') as last_error,
    pc.updated_at
  from plugin_config pc
  join plugins p on p.id = pc.plugin_id
  order by p.plugin_key
"

run_copy "plugin_jobs.csv" "
  select
    p.plugin_key,
    j.job_key,
    j.schedule,
    j.status,
    coalesce(j.last_run_at::text, '') as last_run_at,
    coalesce(j.next_run_at::text, '') as next_run_at,
    j.updated_at
  from plugin_jobs j
  join plugins p on p.id = j.plugin_id
  order by p.plugin_key, j.job_key
"

run_copy "plugin_company_settings_keys.csv" "
  select
    c.issue_prefix,
    p.plugin_key,
    array_to_string(array(select jsonb_object_keys(s.settings_json) order by 1), ',') as setting_keys,
    s.updated_at
  from plugin_company_settings s
  join companies c on c.id = s.company_id
  join plugins p on p.id = s.plugin_id
  order by c.issue_prefix, p.plugin_key
"

run_copy "secret_metadata.csv" "
  select
    c.issue_prefix,
    s.name,
    s.provider,
    coalesce(s.external_ref, '') as external_ref,
    s.latest_version,
    s.updated_at
  from company_secrets s
  join companies c on c.id = s.company_id
  order by c.issue_prefix, s.name
"

run_copy "routines.csv" "
  select
    c.issue_prefix,
    r.title,
    r.status,
    r.priority,
    r.concurrency_policy,
    r.catch_up_policy,
    a.name as assignee_agent,
    r.updated_at
  from routines r
  join companies c on c.id = r.company_id
  join agents a on a.id = r.assignee_agent_id
  order by c.issue_prefix, r.title
"

run_copy "routine_triggers.csv" "
  select
    c.issue_prefix,
    r.title as routine_title,
    t.kind,
    coalesce(t.label, '') as label,
    t.enabled,
    coalesce(t.cron_expression, '') as cron_expression,
    coalesce(t.timezone, '') as timezone,
    coalesce(t.next_run_at::text, '') as next_run_at,
    coalesce(t.last_result, '') as last_result,
    t.updated_at
  from routine_triggers t
  join routines r on r.id = t.routine_id
  join companies c on c.id = t.company_id
  order by c.issue_prefix, r.title, t.kind, t.label
"

cat > "$OUT_DIR/README.md" <<EOF
# Live Export

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Host: $PAPERCLIP_SSH_HOST
Compose dir: $PAPERCLIP_REMOTE_COMPOSE_DIR

This export is sanitized. It contains metadata, config keys, schedules, and secret names only.
Do not commit this directory unless an operator explicitly asks for a snapshot artifact.
EOF

echo "Wrote sanitized Paperclip live config export to: $OUT_DIR"
