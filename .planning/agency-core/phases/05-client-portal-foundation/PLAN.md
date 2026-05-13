# Phase 5: Client Portal Foundation

## Problem

Paperclip is an internal operating system for agents, tasks, runs, plugins, MCP payloads, recovery logic, and technical coordination. Giving a client access to this surface is the wrong product boundary.

The current Semantic Core Review page proved the workflow, but it still lives inside Paperclip and therefore sits too close to internal state. The next step should be a separate client-facing portal where a human sees only business-relevant decisions, dashboards, and approved reporting views.

The neighboring dashboard project is read-only prior art. The client portal implementation must live in:

```text
/Users/savitsky/CodexProjects/paperclip-cs-portal
```

That prior art has useful lessons:

- Next.js App Router application.
- Tenant route shape: `/:companySlug/login`, `/:companySlug/verify`, `/:companySlug/dashboard`, `/:companySlug/semantics`.
- Resend email-code auth.
- Hash-only code/session persistence.
- Dense SEO dashboard composition matching the provided DiskInternals screenshot.

But the portal should not simply clone DiskInternals or continue using BigQuery control tables as the client access source of truth. Paperclip already has company identity and the emerging `seo_ops` PostgreSQL contract. The portal must read and write through a client-safe boundary around Paperclip data.

## Goal

Create a separate client portal surface for SEO/Growth review and reporting.

MVP language is Ukrainian, with localization built in from the start. Astrogen is the first pilot tenant, but the implementation must stay company-agnostic.

The portal must:

- expose no Paperclip tasks, runs, agent logs, MCP raw payloads, internal comments, runtime artifacts, or issue workflows;
- authenticate by email access code sent through Resend;
- generate codes only in memory and persist/compare only hashes;
- keep sessions tenant-scoped and stored as hashes;
- use a Ukrainian-first UI copy model with a translation layer for future locales;
- reuse the visual density and layout lessons from the dashboard reference, but rewrite client-facing wording;
- provide dashboard and workflow pages for semantic-core review, keyword tracking, page performance, content plan review, and decision history.

## Critical Architecture Decision

Build the portal as a separate deployed web application, not as another Paperclip internal route.

Recommended implementation path:

1. Use `/Users/savitsky/CodexProjects/paperclip-cs-portal` as the reusable client-portal app surface owned by agency-core.
2. Treat the dashboard reference as read-only; do not modify it.
3. Keep canonical SEO, semantic-core, rank, page, and decision data in Paperclip PostgreSQL schemas.
4. Add a client-facing Paperclip API boundary, for example `/api/client/...`, that exposes only sanitized company-scoped DTOs and write actions.
5. Let the portal call this client API server-to-server or through a narrow authenticated session adapter. Do not let the portal write raw semantic-core decisions directly into policy tables in a way that bypasses Paperclip validation.

This preserves the important split:

- Paperclip remains the internal control plane.
- Portal becomes the client-facing product.
- PostgreSQL remains the canonical operational store.
- The client API becomes the safety boundary.

## Public Deployment Boundary

The portal is intended to be public, while Paperclip itself must remain private.

Target public hostname:

- `cs.digital-r-evolution.com`

Required boundary:

- expose only the client portal on public HTTPS;
- keep Paperclip internal UI/API on Tailscale/private network only;
- do not make `/AST`, Paperclip issue pages, agent run logs, plugin routes, or internal `/api/seo/...` public;
- allow the portal backend to reach the sanitized Paperclip client API through a private route only, such as localhost, Docker network, or Tailscale IP;
- authenticate the portal-to-Paperclip server call with a dedicated service token or mTLS-style shared secret, not with a user browser cookie.

Recommended host layout:

```text
public internet
  -> cs.digital-r-evolution.com:443
  -> reverse proxy
  -> client-portal container on localhost/docker network
  -> private Paperclip client API on localhost/docker network/Tailscale

Tailscale only
  -> Paperclip internal UI and internal APIs
```

Public deployment requirements:

- DNS for `cs.digital-r-evolution.com` points to the server public IP after the portal is ready.
- Nginx terminates TLS with Let's Encrypt certificates.
- Use Certbot with the Nginx plugin or a webroot challenge; renewal must be covered by the system timer and verified with a dry run.
- Only ports `80` and `443` should be public for the portal host; Paperclip's application port must stay bound to localhost/private network.
- The portal application port must bind to `127.0.0.1` or a private Docker network, not `0.0.0.0` publicly.
- Nginx must proxy only to the portal upstream and must not route `/AST`, `/api/seo`, Paperclip issue paths, plugin paths, or any internal Paperclip upstream.
- Nginx must pass `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`, and `X-Real-IP` so the app can enforce origin, cookie, and audit behavior correctly.
- Add HSTS after the first successful HTTPS deployment.
- Set `PORTAL_BASE_URL=https://cs.digital-r-evolution.com`.
- Set auth cookies as `Secure`, `HttpOnly`, `SameSite=Lax`, path `/`, no `Domain` attribute when using `__Host-` cookies.
- Add strict allowed-origin checks for POST requests.
- Add `X-Frame-Options` / CSP frame protection.
- Add `robots`/`noindex` for authenticated pages and avoid indexing login/verify pages unless there is an explicit marketing reason later.
- Add public-rate-limit protection for login/code endpoints. If abuse appears, add Cloudflare Turnstile or equivalent after the first few failed attempts, not as a default UX blocker.
- Resend sender domain must have SPF/DKIM/DMARC configured before production use.
- Production secrets must live in a server-side `.env` or secret store outside Git. The local `/Users/savitsky/CodexProjects/paper-clip/.env` may be used as the source for `RESEND_API_KEY`, but the value must never be copied into planning files, logs, commits, screenshots, or issue comments.
- The production portal env must include all required non-secret config in addition to secrets, especially `RESEND_FROM_EMAIL`, `PORTAL_BASE_URL`, session/code peppers, and the private Paperclip client API settings.

Do not point the public DNS record until:

- login and verify flow are hash-only and tested;
- inactive or unknown emails receive generic responses;
- portal routes reject cross-company sessions;
- Paperclip internal routes are unreachable from the public hostname;
- TLS and cookie settings are verified in production mode.
- Certbot renewal dry run passes.
- Nginx config test passes and reload does not interrupt private Paperclip.

## Auth Contract

### Routes

- `/:companySlug/login`: first screen; only asks for email and explains that a code will be sent if access is active.
- `/:companySlug/verify`: asks for email and six-digit code.
- `/:companySlug/dashboard`: company dashboard after valid session.
- `/:companySlug/logout`: POST-only logout endpoint or form action.

The first visible portal screen must not show dashboard navigation, internal labels, product claims, or agent language. It should simply ask for the user's work email in Ukrainian.

### Code Generation

- Generate a six-digit code with cryptographic randomness.
- Send the plain code only through Resend.
- Never persist the plain code.
- Persist only an HMAC/hash of `company_id + normalized_email + code` with a server-side pepper.
- Compare hashes using timing-safe comparison.
- Expire codes quickly, default 10-15 minutes.
- Mark codes as used after successful verification.
- Invalidate or supersede older active codes for the same company/email when a new code is requested.

### Sessions

- Generate high-entropy session tokens.
- Persist only session hashes.
- Session expiration defaults to 14 days and must be configurable with `PORTAL_SESSION_TTL_DAYS`.
- Use `__Host-` cookie prefix where deployment allows it.
- Cookie must be `httpOnly`, `secure`, `sameSite=lax`, path `/`.
- Session validation must check company, active user access, user-company binding hash, expiry, and revocation.
- Logout revokes the hashed session server-side and clears the cookie.
- Session records must not be valid if the linked user-company access row is disabled, deleted, expired, or has a changed binding hash.

### Access Model

- Login is allowed only for normalized emails that already exist in the portal database.
- Email access must be scoped to a specific company, not global.
- Store a separate user-company binding hash, for example HMAC of `company_id + normalized_email + role + access_version`, so sessions can bind to the exact company access grant without storing or trusting a mutable plain identifier alone.
- Store the binding hash on the session at login time and verify it against the current active access row on every session validation.
- Rotating `access_version`, disabling access, changing role, or removing the company binding must invalidate existing sessions for that company/email.
- A user may have access to multiple companies, but every session is for one company only.

### Abuse Controls

- Generic success responses for code requests to avoid account enumeration.
- Rate limits per company/email and per IP hash.
- Audit events for request-code, verify-code success/failure, logout, expired session, and forbidden tenant access.
- Hash IP/user-agent for audit/rate-limit records; do not store raw values unless explicitly needed by deployment policy.

### Resend

Required env:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `PORTAL_AUTH_CODE_PEPPER`
- `PORTAL_SESSION_SECRET`
- `PORTAL_ACCESS_BINDING_PEPPER`
- `PORTAL_SESSION_TTL_DAYS` default `14`
- `PORTAL_BASE_URL`
- `PAPERCLIP_CLIENT_API_BASE_URL` private server-side URL
- `PAPERCLIP_CLIENT_API_SERVICE_TOKEN` or equivalent server-only credential

Email templates must be localized. Ukrainian is the default.

## Data Model

Add a dedicated client portal schema or prefixed tables in Paperclip PostgreSQL:

- `client_portal_users`
- `client_portal_company_access`
- `client_portal_login_codes`
- `client_portal_sessions`
- `client_portal_audit_log`
- `client_portal_invites` if invitation flows are needed

Minimum fields:

- company ID;
- normalized email;
- display name optional;
- role: `owner`, `reviewer`, `viewer`;
- active flag;
- access version or grant version;
- user-company binding hash;
- locale preference;
- code/session hash fields;
- expiry/revocation timestamps;
- audit metadata hashes.

Recommended access/session fields:

- `client_portal_company_access.access_hash`
- `client_portal_company_access.access_version`
- `client_portal_sessions.session_hash`
- `client_portal_sessions.access_hash`
- `client_portal_sessions.expires_at`
- `client_portal_sessions.revoked_at`
- `client_portal_sessions.last_seen_at`

Do not duplicate `seo_ops` data into portal-specific tables. Portal pages should read sanitized DTOs from Paperclip client APIs.

## Client API Boundary

Create a dedicated API layer for portal consumption.

Implemented Paperclip-side foundation:

- `GET /api/portal/companies/:companySlug/semantic-core/review`
- `POST /api/portal/semantic-core/review-items/:itemId/decision`

These routes are protected by `PAPERCLIP_PORTAL_SERVICE_TOKEN` and are intended for server-to-server calls from the portal backend only. The browser must never receive this token.

Initial endpoints:

- `GET /api/client/:companySlug/me`
- `GET /api/client/:companySlug/dashboard`
- `GET /api/client/:companySlug/semantic-core/batches`
- `GET /api/client/:companySlug/semantic-core/batches/:batchId`
- `PATCH /api/client/:companySlug/semantic-core/items/:itemId/decision`
- `PATCH /api/client/:companySlug/semantic-core/items/:itemId/connection`
- `GET /api/client/:companySlug/keywords`
- `GET /api/client/:companySlug/pages`
- `GET /api/client/:companySlug/content-plan`
- `GET /api/client/:companySlug/decisions`

These endpoints must:

- resolve company from session, not from user-controlled request body alone;
- return only human-facing labels and evidence summaries;
- hide raw MCP payloads, provider secrets, agent comments, task IDs unless explicitly transformed into a safe reference;
- run the same semantic-core policy guardrails as internal Paperclip;
- audit all write actions with portal user email/session/company.

## Localization

MVP locale: Ukrainian.

Design for more locales now:

- All portal copy must come from translation dictionaries or typed message keys.
- Company config should include default locale.
- User profile may override locale later.
- Avoid hard-coded English labels in dashboard components.
- Avoid technical labels like `core_product_intent`, `product_binding`, `import_readiness`, `MCP payload`.
- Store machine enum values in data, but map them to localized human labels at the API/view boundary.

Suggested route-level locale strategy for MVP:

- Use company default locale first.
- Use `uk` fallback.
- Do not expose language switching until the second tenant needs it.

## Product Pages

### 1. Login

Purpose: secure access only.

Content:

- company mark/name;
- one email field;
- primary action: `Отримати код`;
- short Ukrainian explanation that code will be sent if access is active;
- no dashboard screenshots, no internal security slogans, no Paperclip vocabulary.

### 2. Verify Code

Purpose: finish login.

Content:

- email;
- six-digit code;
- primary action: `Увійти`;
- resend option with cooldown;
- clear expired/invalid state.

### 3. Company Dashboard

Use the provided dashboard screenshot and the read-only dashboard implementation as structural reference:

- large company identity;
- compact filter bar;
- executive state;
- traffic/acquisition summary;
- search visibility;
- priority alerts;
- page/content risks;
- content operations;
- semantic-core review status;
- data freshness/quality.

But rewrite the content model for clients:

- Ukrainian labels for Astrogen.
- No "tailnet-only", "no URL/query leak", "proxy pages", or other internal/security implementation copy.
- Focus on business-readable questions:
  - що росте;
  - що просідає;
  - які сторінки потребують уваги;
  - які рішення очікують власника;
  - чи дані достатньо свіжі для висновків.

### 4. Semantic Core Review

Client-facing version of the current Paperclip Semantic Core Review GUI:

- stage context;
- accepted semantic core;
- decision queue;
- all keywords;
- resizable/sortable table columns;
- human service/brand/topic connection;
- decision explanations;
- audit history for the item;
- no raw MCP payloads.

### 5. Keywords

Tracked keywords and candidates:

- accepted semantic-core terms;
- tracked SERP terms;
- GSC-derived candidate terms;
- status: tracked, candidate, approved pending sync, rejected, snoozed;
- filters by topic/service/page/geo/language/device;
- no provider raw dumps.

Use the provided `semantics` screenshot and the new `/Users/savitsky/CodexProjects/paperclip-cs-portal` implementation as the structural base, with client-safe changes.

Page sections:

- header: `Ключові запити` with company/project context and a compact explanation of current tracking state;
- filters: period mode, date range when applicable, geo, language, service/topic, status, search field;
- KPI strip:
  - tracked keywords;
  - keywords needing decision;
  - pages with visible rankings;
  - latest tracking date / freshness;
- `Прогалини в ключах`: high-demand or high-opportunity GSC queries not yet tracked or not yet approved;
- `Можливості з GSC`: query + current page + clicks/impressions/CTR/position + suggested action;
- `Відстежувані ключі`: tracked keyword rows with current/baseline position, page URL, geo/language/device, movement, and freshness;
- `Очікують додавання в трекінг`: approved keywords not yet synced to the rank provider;
- `Відхилені / відкладені`: rejected and snoozed terms with decision reason and reopen action where role permits;
- `Стан збору даних`: last successful sync, next scheduled sync, coverage gaps, provider health summary.

Client-facing behavior:

- Column headers must sort.
- Wide tables may scroll horizontally.
- Row actions must be role-aware: `approve`, `reject`, `snooze`, `reopen`, `request page review`.
- Normal client roles must not see provider project IDs, API settings, raw SpySERP/Serper payloads, quota internals, or direct `sync now` controls.
- Owner/admin roles may see a read-only tracking policy summary and may request changes, but actual provider/sync configuration stays internal.
- Display page URLs only when they are useful for decisions; do not expose raw query dumps beyond the selected keyword/query row.

### 6. Pages

Page-level SEO view:

- page URL/title;
- target keywords;
- current best SERP positions by context;
- GSC/GA4 decision digests;
- recent actions and cooldown;
- recommendation: refresh, wait, create new page, consolidate, no action.

### 7. Content Plan

Human approval surface for content work:

- proposed article/page;
- target query cluster;
- intent;
- linked service;
- expected role in funnel;
- owner decision: approve, reject, revise, defer.

### 8. Decisions

Audit-friendly view:

- semantic-core decisions;
- content-plan approvals;
- page-action approvals;
- no-action decisions;
- who decided, when, and what changed.

## Design Direction

Use the dashboard reference as the starting visual grammar:

- large brand/company title;
- pale analytical background;
- dense rectangular panels;
- strong left-edge status color;
- compact filter controls;
- tables built for scanning;
- dashboard sections as full-width bands/panels.

Adapt for Astrogen:

- Ukrainian text;
- calmer client-facing terms;
- Astrogen brand cues where available;
- avoid turning the client portal into a marketing landing page;
- keep operational density, but remove internal warnings that are only meaningful to operators.

Responsive behavior:

- dashboard must remain usable on laptop widths;
- review tables can scroll horizontally where necessary;
- key decision actions must be usable on tablet/mobile;
- long Ukrainian labels must not overflow controls.

## Implementation Steps

1. Repository placement is decided: use `/Users/savitsky/CodexProjects/paperclip-cs-portal`.
2. Replace BigQuery control/auth persistence with Paperclip PostgreSQL portal tables, or add a migration path if keeping the current standalone app temporarily.
3. Add portal auth schema and migrations.
4. Add Resend-backed request-code and verify-code flows with hash-only code persistence and database-only email/company eligibility.
5. Add 14-day configurable session storage, hash-token validation, user-company binding hash validation, logout, audit, and rate limiting.
6. Add typed localization dictionaries with Ukrainian as default.
7. Add client-safe Paperclip API endpoints for dashboard summary and semantic-core review.
8. Port/adapt the dashboard shell into a company-agnostic portal dashboard inside `/Users/savitsky/CodexProjects/paperclip-cs-portal`.
9. Build the client-facing Semantic Core Review page by reusing the current Paperclip review logic through sanitized DTOs.
10. Build the Keywords page from the `semantics` screenshot structure: gaps, GSC opportunities, tracked keywords, pending sync, rejected/snoozed, and data collection status.
11. Add placeholder navigation/routes for Pages, Content Plan, and Decisions, then fill the first useful data slices.
12. Seed Astrogen portal company access and at least one allowed owner email.
13. Deploy the portal as a separate app bound to localhost/private Docker network.
14. Configure Nginx for `cs.digital-r-evolution.com` and obtain Let's Encrypt certs with Certbot.
15. Keep Paperclip internal UI/API private on Tailscale and verify that the public hostname cannot reach Paperclip internal routes.
16. Verify DNS, TLS, HSTS-readiness, cookie flags, allowed origins, public rate limits, Certbot renewal dry run, and Nginx route isolation before giving the URL to a client.

## Acceptance Criteria

- A client can open the portal URL and first sees only the email-code login screen.
- Resend sends the access code.
- The plain access code is never stored in DB, logs, or audit records.
- Verification compares only hashes using timing-safe comparison.
- Only active emails with an active company access row can complete login.
- Every session is bound to one company through a verified user-company access hash.
- Session expiry defaults to 14 days and is configurable.
- Session tokens are stored only as hashes.
- Disabling or rotating a user's company access invalidates existing sessions for that company.
- Unauthorized email requests do not reveal whether the email exists.
- A valid Astrogen user lands on a Ukrainian company dashboard.
- The dashboard uses the approved visual structure but contains client-safe Ukrainian wording.
- A valid Astrogen user can review semantic-core items without Paperclip access.
- A valid Astrogen user can open a Keywords page that follows the `semantics` screenshot structure while hiding provider settings, sync controls, raw payloads, and internal budget details from normal client roles.
- Semantic-core decisions made in the portal pass the same policy guardrails as internal Paperclip decisions.
- No portal route exposes Paperclip issues, runs, MCP raw payloads, agent logs, plugin settings, secrets, or internal comments.
- `https://cs.digital-r-evolution.com` exposes only the client portal, not the internal Paperclip UI.
- Paperclip internal routes remain unreachable from the public hostname and remain available only through private access.
- Portal server-to-Paperclip calls use a private server-side URL plus a server-only credential.
- Nginx terminates HTTPS with a valid Let's Encrypt certificate and proxies only to the portal upstream.
- Certbot renewal dry run succeeds.
- Locale strings are not hard-coded directly inside major components.

## Verification

- Unit tests for code generation, hash comparison, expiry, one-time use, and generic responses.
- Unit tests for session hash validation, 14-day/default expiry, configurable TTL, revocation, tenant mismatch, inactive user access, and changed user-company access hash.
- API tests proving portal endpoints reject cross-company access.
- API tests proving semantic-core writes still apply policy guardrails.
- API tests proving Keywords endpoints return sanitized keyword/page/status DTOs without provider payloads or sync configuration.
- UI tests for login, verify, dashboard redirect, logout, and expired session.
- UI tests for Keywords filters, sorting, role-aware actions, and hidden provider controls.
- Public deployment smoke tests for `cs.digital-r-evolution.com` HTTPS, Nginx routing, Certbot renewal, cookie flags, generic login responses, allowed-origin checks, and internal route isolation.
- Accessibility smoke checks for login/verify forms.
- Visual check against the provided dashboard reference for layout density without copying internal DiskInternals wording.
- Visual check against the provided semantics reference for keyword workflow density without exposing internal sync controls to normal client roles.
- Security review checklist:
  - no plain codes in DB;
  - no plain session tokens in DB;
  - no sessions without active company access hash;
  - no raw MCP payloads in portal JSON;
  - no provider raw payloads or API settings in Keywords page JSON;
  - no Paperclip internal routes linked from portal;
  - no Paperclip internal routes reachable from the public hostname;
  - portal-to-Paperclip service token is server-only;
  - Nginx has no location block that proxies public requests to Paperclip internal routes;
  - Resend API key and other production secrets are present only in server env/secret store and never in Git or planning docs;
  - no plaintext secrets in repository.

## Non-Goals

- Do not replace Paperclip internal Semantic Core Review immediately; keep it as operator/admin view.
- Do not expose Paperclip itself publicly; only the client portal may be public.
- Do not add full billing, user self-management, or CMS publishing in this phase.
- Do not duplicate full GSC/GA4 warehouses into portal tables.
- Do not build a generic white-label theming system beyond basic company name/logo/color hooks.

## Open Decisions

- Repository placement: resolved to `/Users/savitsky/CodexProjects/paperclip-cs-portal`; do not modify the read-only dashboard reference.
- Auth data home: dedicated portal schema in Paperclip PostgreSQL is preferred; confirm whether any existing BigQuery control data must be migrated.
- Deployment URL: `cs.digital-r-evolution.com` is the intended public hostname; use Nginx with Let's Encrypt via Certbot.
- First pilot company: Astrogen appears to be the right pilot because the semantic-core review workflow is already active and Ukrainian-facing.
