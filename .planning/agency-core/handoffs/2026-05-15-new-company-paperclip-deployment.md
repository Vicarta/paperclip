# Handoff: New Company Deployment In Paperclip

Date: 2026-05-15

## Branch / Workspace

Use this worktree for the new-company deployment work:

```text
/path/to/paper-clip-new-company
```

Branch:

```text
codex/new-company-paperclip-deployment
```

Base commit:

```text
5d705473 docs: sanitize local operator paths
```

Do not continue this work in the Astrogen/DiskInternals main worktree unless explicitly requested.

## Current Production Context

Paperclip production source-of-truth docs now live under:

```text
ops/paperclip-production/
```

Current known production baseline:

- app image: `paperclip-app:v2026.513.0-phase17.1`
- production host: `ubuntu-oc.tailbd4e1c.ts.net`
- compose path on server: `/home/paperclip/apps/paperclip`
- health endpoint from server: `http://127.0.0.1:3200/api/health`
- plugins at last smoke: `12/12` ready
- Telegram issue lifecycle notifications: one canonical path through `paperclip-plugin-telegram`

The repo is public-facing enough that all new docs/config must be sanitized:

- no plaintext secrets;
- no local operator paths;
- no token filenames that reveal private local layout;
- no generated `ops/paperclip-production/live-export/*.csv`;
- commit and push after completed changes.

## Scope For The Next Chat

Deploy a new company inside Paperclip as a separate company scope.

The new company must not reuse Astrogen or DiskInternals:

- issue prefix;
- budgets;
- agents;
- projects;
- secrets;
- workspace directories;
- client portal config;
- semantic-core state;
- GSC/GA/Serper/DataForSEO credentials.

Use `.planning/company/<new-company-slug>/` for company-specific planning.
Use `.planning/agency-core/` only for reusable/shared process changes.

## Start Checklist

1. Confirm the new company details with the operator:
   - company name;
   - short slug/key;
   - issue prefix;
   - website URL(s);
   - human-facing language;
   - owner/contact email(s);
   - initial services/products;
   - whether client portal access is needed immediately.

2. Inspect live Paperclip state before changing it:
   - existing companies and issue prefixes;
   - existing agents/templates that should be copied or adapted;
   - enabled plugins and company settings;
   - current routines/jobs that may need company-specific equivalents.

3. Create company planning skeleton:
   - `.planning/company/<slug>/README.md`
   - `.planning/company/<slug>/REQUIREMENTS.md`
   - `.planning/company/<slug>/ROADMAP.md`
   - `.planning/company/<slug>/STATE.md`
   - `.planning/company/<slug>/PAPERCLIP_ENTITY_MAP.md`

4. Create the Paperclip company through Paperclip API/CLI/UI, not by ad hoc DB edits unless there is no supported path.

5. Create or assign the minimal initial agent set only after company scope exists.

6. Add secrets through Paperclip Secrets only. Store refs/names in docs, never values.

7. Run production smoke after deploy:
   - company appears in Paperclip;
   - issue prefix works;
   - agents are scoped to the new company;
   - plugin access is scoped correctly;
   - Telegram/HIA messages do not mention internal implementation details;
   - no Astrogen/DiskInternals data is visible in the new company scope.

8. Update `ops/paperclip-production/` if live production config changed.

9. Commit and push the branch.

## Suggested GSD Phase

Create a new phase under:

```text
.planning/company/<slug>/phases/01-paperclip-company-bootstrap/
```

Recommended acceptance criteria:

- new company exists in Paperclip with unique issue prefix;
- minimal projects/agents/routines are created and documented;
- secrets are configured as refs only;
- company workspace path is documented and writable by Paperclip runtime if needed;
- first test issue can be created and handled by the intended agent;
- source-of-truth docs are committed and pushed.

## Important Guardrails

- Do not modify `/path/to/seo-dashboard` or any other reference project.
- Do not copy Astrogen semantic-core runs, portal batches, or issue IDs into the new company.
- Do not copy DiskInternals BigQuery configuration unless the new company explicitly needs that plugin.
- Keep company-specific docs in the company folder.
- Keep public repo hygiene: use placeholders like `/path/to/paper-clip`, not operator home paths.
- If a secret-like string appears in a diff, stop and remove it before commit.

## Useful References

- Production source of truth: `ops/paperclip-production/README.md`
- Plugin manifest: `ops/paperclip-production/manifests/plugins.md`
- Secret refs manifest: `ops/paperclip-production/manifests/secrets.md`
- Live export tool: `ops/paperclip-production/scripts/export-live-config.sh`
- Agency roadmap: `.planning/agency-core/ROADMAP.md`
- Astrogen example company planning: `.planning/company/astrogen/`
- DiskInternals example company planning: `.planning/company/diskinternals/`

## First Message For The Next Codex Chat

Use this prompt:

```text
Continue in /path/to/paper-clip-new-company.
Read .planning/agency-core/handoffs/2026-05-15-new-company-paperclip-deployment.md.
We are deploying a new company in Paperclip. Do not touch Astrogen or DiskInternals except as examples. Use GSD planning, keep GitHub public hygiene, and commit/push after completed changes.
```
