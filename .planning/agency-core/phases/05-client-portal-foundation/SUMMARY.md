# Phase 5 Summary: Client Portal Foundation

## Status

Partially implemented. The client-portal code has been moved into a standalone project at `/Users/savitsky/CodexProjects/paperclip-cs-portal` on 2026-05-07.

Public Nginx + Let's Encrypt activation must be redone from the standalone portal project after the server/firewall target is confirmed.

## Implemented

- Earlier portal auth work established the required user-company access binding contract:
  - added `ACCESS_BINDING_PEPPER`;
  - added `access_hash` and `access_version` to company-user access;
  - added `access_hash` to auth sessions;
  - sessions now validate the session hash and the current active company access hash;
  - disabling/rotating access invalidates existing sessions for that company binding.
- Corrected the portal control-plane storage direction to PostgreSQL:
  - the standalone portal must use a dedicated PostgreSQL portal control plane;
  - added `migrations/postgres/001_portal_control.sql`;
  - moved company lookup, allowlisted users, auth codes, sessions, rate limits, and auth audit writes from BigQuery to Postgres;
  - kept BigQuery only as the analytics warehouse and one-time legacy control backfill source.
- Kept auth code/session behavior hash-only:
  - plain codes are sent only through Resend;
  - code hashes and session hashes are persisted;
  - default session TTL remains 14 days through configuration.
- Prepared public deployment assets:
  - Nginx vhost for `cs.digital-r-evolution.com`;
  - Certbot bootstrap/install script;
  - public route isolation for internal Paperclip paths;
  - deployment script updated for `APP_BASE_URL=https://cs.digital-r-evolution.com`;
  - app container remains bound to `127.0.0.1:3000`.
- Created the standalone portal workspace `/Users/savitsky/CodexProjects/paperclip-cs-portal` and verified the baseline locally.
- Applied the PostgreSQL migration and backfilled the current legacy company/user allowlist into Postgres.

## Verification

- `/Users/savitsky/CodexProjects/paperclip-cs-portal`: `npm run lint`
- `/Users/savitsky/CodexProjects/paperclip-cs-portal`: `npm run typecheck`
- `/Users/savitsky/CodexProjects/paperclip-cs-portal`: `npm run build`
- `/Users/savitsky/CodexProjects/paperclip-cs-portal`: `npm run verify:v1`
- PostgreSQL migration applied:
  - `migrations/postgres/001_portal_control.sql`
- PostgreSQL backfill:
  - `companies=1`
  - `users=1`
- No public redeploy has been performed from the new standalone project yet.

## Blocker

Current DNS now points to the target server:

```text
cs.digital-r-evolution.com A    89.167.61.146
cs.digital-r-evolution.com AAAA 2a01:4f9:c014:aa9a::1
```

Nginx is installed and listens on public `:80`; UFW now allows `80/tcp` and `443/tcp`. However external probes to `89.167.61.146:80` time out, and `tcpdump` on the server captures zero packets during the external probe. This indicates an upstream/cloud firewall before the server. Let's Encrypt HTTP challenge cannot complete until provider-level TCP 80/443 is allowed.

## Next Step

After the portal host and provider-level firewall are confirmed, deploy from:

```text
/Users/savitsky/CodexProjects/paperclip-cs-portal
```

Then run the Nginx/Let's Encrypt activation from that project.

```bash
LETSENCRYPT_EMAIL=o.savitsky@gmail.com npm run deploy:nginx
```

Then verify public HTTPS, cookie flags, Nginx route isolation, and Certbot renewal.
