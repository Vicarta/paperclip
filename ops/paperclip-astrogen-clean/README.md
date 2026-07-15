# Clean Paperclip Astrogen Deployment

This directory contains the sanitized deployment shape for a fresh Paperclip instance dedicated to Astrogen.

It intentionally does not include live `.env` files, database dumps, Docker volumes, runtime caches, plaintext secrets, or generated exports.

## Target

- Server: `ubuntu-oc.tailbd4e1c.ts.net`
- SSH alias used for ops: `oc_hermes`
- Live directory: `/home/paperclip/apps/paperclip-astrogen-clean`
- Compose project: `paperclip-astrogen-clean`
- App port: `127.0.0.1:3210` and `100.98.5.50:3210`
- Tailnet URL: `http://ubuntu-oc.tailbd4e1c.ts.net:3210`
- Old Paperclip/Astrogen runtime was stopped on 2026-07-02 and should remain
  offline unless an explicit rollback/recovery decision is made.

## First Smoke

```bash
cd /home/paperclip/apps/paperclip-astrogen-clean
sudo docker compose -p paperclip-astrogen-clean config
sudo docker compose -p paperclip-astrogen-clean up -d
curl -fsS http://127.0.0.1:3210/api/health
curl -fsS http://ubuntu-oc.tailbd4e1c.ts.net:3210/api/health
```

## Access

Open the clean Astrogen instance from a Tailscale-connected device:

```text
http://ubuntu-oc.tailbd4e1c.ts.net:3210
```

The raw Tailnet IP is bound for Docker exposure, but Paperclip host/origin guards expect the MagicDNS host. Use the DNS URL for browser access.

If direct Tailnet access is unavailable, use an SSH tunnel:

```bash
ssh -L 3210:127.0.0.1:3210 oc_hermes
```

Then open `http://127.0.0.1:3210`.

## Rules

- Do not reuse the old Paperclip database.
- Do not mount `/home/paperclip/astrogen` into this clean instance.
- Do not add provider/API tokens to `.env`; configure provider secrets through Paperclip secret refs after onboarding.
- Keep this instance Tailnet-only unless a separate public exposure review is completed.

## Growth OS Bootstrap

Phase 40 uses source-controlled manifests under `manifests/` and an idempotent
server-side bootstrap script:

```bash
sudo node /tmp/astrogen-phase40/scripts/bootstrap-astrogen-growth-os.mjs --dry-run
sudo node /tmp/astrogen-phase40/scripts/bootstrap-astrogen-growth-os.mjs --apply
```

The apply path:

- creates a clean DB backup in `/home/paperclip/backups/`;
- creates the clean local secrets master key if it does not exist;
- migrates secret values encrypted-to-encrypted without printing them;
- registers only allowlisted active plugins and parks unsafe/error-prone plugins;
- creates active Astrogen agents with idle timer heartbeats disabled;
- creates routines as `paused` with disabled triggers, `skip_missed`, and no
  expensive catch-up behavior;
- creates a selective transition pack instead of bulk-importing old live tasks.

## GSC/Bing/GA4 MCP Bridge

The clean compose project uses its own Docker bridge. The clean app container
currently reaches the private GSC/Bing/GA4 MCP server through:

```text
http://172.18.0.1:3002/mcp
```

Server-side support:

```text
systemd: paperclip-gsc-mcp-proxy-clean.service
listen: 172.18.0.1:3002
target: 100.98.5.50:3002
ufw: allow 172.18.0.0/16 -> 172.18.0.1:3002 on br-1bc1fd43b330
```

The source copy of the unit is
`ops/paperclip-astrogen-clean/systemd/paperclip-gsc-mcp-proxy-clean.service`.

Do not point the clean plugin at the MagicDNS hostname from inside the app
container. The container path should use the bridge proxy, while browser access
to Paperclip itself should keep using the MagicDNS URL.

## Current Activation State

As of 2026-07-03, the clean Astrogen SEO/release/content routine set is active and has
passed scheduler-backed execution proof:

- `Daily Astrogen deterministic evidence collection`
- `Daily Astrogen due-URL GSC indexing audit`
- `Daily Astrogen leadership backlog triage`
- `Astrogen article slot allocator`
- `Weekly Astrogen SEO/GEO action cycle`
- `Weekly Astrogen Paperclip operating improvement review`
- `Weekly Paperclip clean release check`

The active SEO routines are on tightened Phase 41 contracts:

- canonical scope is `https://astrogen.com.ua`,
  `sc-domain:astrogen.com.ua`, and `https://cms.astrogen.com.ua/api`;
- agents use `/api/agents/me/plugin-tools` and
  `/api/agents/me/plugin-tools/execute` for plugin data;
- routine outputs must use compact selected fields and avoid raw plugin JSON
  dumps.

The `Daily Astrogen leadership backlog triage` routine is assigned to CEO and
runs after daily evidence/indexing jobs. It routes unassigned backlog/todo work
to CEO, CMO, CTO, or the right specialist, while leaving parked items only when
they have an explicit owner and reason. CEO is the routing owner, not the
domain executor: CEO may prioritize, assign, create bounded child issues, set
blockers, and record routing decisions, but specialist execution must be routed
to CMO, CTO, HIA, or the correct specialist agent.

The `Weekly Astrogen Paperclip operating improvement review` routine is assigned
to CTO and runs every Wednesday at 12:30 Europe/Kiev after the weekly business
and SEO review windows. It reviews failed/cancelled/stranded runs, manual
repairs, contract drift, plugin/runtime issues, cost-accounting signals, and
owner feedback from the previous Wednesday-Tuesday operating week. Read-only
analysis may run freely, but any live change to agent instructions, workflow or
routine contracts, plugin settings, scheduler/runtime config, or production
manifests requires a fresh DB backup first and an owner email report to
`o.savitsky@gmail.com` after verification. System/change/incident email goes
through `paperclip.email-notifications`, not the SEO Performance Loop plugin.
The email plugin uses concrete configured recipients:
`defaultRecipientEmails=o.savitsky@gmail.com` and
`allowlistedRecipientEmails=o.savitsky@gmail.com`, with the Resend API key held
only as the `resend-api-key` secret ref. If backup or configured email delivery
is unavailable, the routine must not apply optional changes and must route a CTO
blocker instead.

The `Weekly Astrogen SEO/GEO action cycle` routine must deliver its detailed
weekly report through `paperclip.email-notifications:email-seo-weekly-report-send`.
It may close `done` only after recording email delivery proof, or after linking a
CTO-owned email transport blocker when sender, recipients, Resend secret-ref, or
the email tool path is unavailable. Internal Paperclip comments/documents alone
are fallback evidence, not successful delivery, when email is configured.

Search-demand discovery and action selection are native Paperclip pipelines.
`astrogen-search-demand-opportunities` runs before topic inventory and enforces
`discovered -> evidence_ready -> ownership_review -> action_selected -> delegated
-> verified -> measured`. Only `selectedAction=new_article` can use guarded
native breakdown to create an `astrogen-topic-inventory` candidate. Refresh,
merge, reposition, internal-link and technical decisions route to execution
lanes instead of creating article ideas.

## Old Runtime Stop

The old Docker-level Astrogen surface is intentionally offline:

```text
compose project paperclip: exited
compose project astrogen-files: exited
old Paperclip port 3200: not listening
old FileBrowser port 8088: not listening
```

Stopped containers have `restart=no`:

```text
paperclip-app-1
paperclip-db-1
astrogen-files-filebrowser-1
```

Rollback evidence before stop:

```text
/home/paperclip/backups/old-live-before-docker-stop-20260702T204340Z.dump
/home/paperclip/backups/old-astrogen-before-docker-stop-20260702T204340Z.txt
```
