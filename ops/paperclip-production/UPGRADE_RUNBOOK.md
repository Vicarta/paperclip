# Paperclip Production Upgrade Runbook

This runbook keeps future Paperclip upgrades repeatable. It is intentionally operational and sanitized: no plaintext secrets, keys, DB dumps, or runtime caches belong in Git.

## 1. Preflight

- Confirm target upstream tag and release notes.
- Confirm current production image tag.
- Confirm current local source branch and whether it has a merge-base with the target tag.
- Check working tree cleanliness.
- Export sanitized production config with `ops/paperclip-production/scripts/export-live-config.sh`.
- Record plugin inventory, routine inventory, secret names, and agent runtime policy.

## 2. Backups

Before any deploy:

- create a Postgres dump;
- snapshot or archive the Paperclip data volume;
- export managed instruction bundles;
- archive local plugin packages;
- record restore commands and storage locations outside Git.

Do not continue if backup paths and restore steps are not written down.

## 3. Branch Strategy

- Create upgrade branches from the upstream release tag.
- Do not directly merge old convergence branches when histories/layouts diverge.
- Port local changes by topic.
- Keep production overlays in `ops/paperclip-production`.
- Keep company contracts in company repos or managed instruction bundles.

## 4. Patch Inventory

Every local change must be classified:

| Local area | Decision | Notes |
| --- | --- | --- |
| Telegram lifecycle/noise/proof/writeback | retain / replace / drop |  |
| Payload CMS tools | retain / replace / drop |  |
| MCP session close and allowlists | retain / replace / drop |  |
| SEO Ops schema/plugins | retain / replace / drop |  |
| Agent wakeup/watchdog fixes | retain / replace / drop |  |
| UI removals/customizations | retain / replace / drop |  |
| Planning/ops docs | retain outside app source |  |

## 5. Staging Smoke

Run the upgrade against a restored production-like DB before production:

- app health;
- login/auth;
- board load for Astrogen and DiskInternals;
- issue create/comment/status update;
- agent wake-on-demand;
- child completion parent wake;
- managed instruction bundle read/write;
- plugin manager;
- Telegram escalation reply writeback;
- Telegram concise CMS draft notification;
- Payload CMS build state, media upload, draft create/update;
- Search Console MCP call and transport close;
- CrawlObserver adapter health;
- cost event write where applicable.

## 6. Production Cutover

- Enter quiet window.
- Take final backup.
- Update compose image tag.
- Pull/start app.
- Watch migrations and logs.
- Run production smoke.
- Update manifests and README with final image tag and verification date.

## 7. Rollback

- Stop app.
- Restore previous image tag.
- If migrations are backward-compatible, restart old image.
- If not, restore DB dump and data volume snapshot.
- Verify health, UI, plugin load, Telegram, and Payload CMS.
- Open a follow-up issue with the failed gate and rollback reason.

## 8. Post-Upgrade

- Commit and push updated `ops/paperclip-production` manifests.
- Record release features enabled and local patches removed.
- Create follow-up issues for any deferred compatibility cleanup.
