# Phase 15: Paperclip Document Annotations And Secret Config Rollout

## Objective

Use the useful `paperclipai/paperclip v2026.529.0` collaboration and configuration features in real operating contracts, not only as platform capabilities.

The rollout focuses on four changes:

1. Owner decisions and approvals move from long comments into canonical issue documents with a short Telegram pointer.
2. Reviewable work products use issue documents and inline annotations where the reviewer needs to point at exact text, URL rows, or report sections.
3. Accepted artifacts are locked/frozen so later agents do not silently mutate already approved briefs, reports, or delivery summaries.
4. Production plugin configuration uses secret references and company-scoped settings, with UI-friendly secret binding fields where the platform exposes them.

## Non-Goals

- Do not rewrite the Paperclip runtime UI.
- Do not migrate every historical comment or old artifact.
- Do not use documents for tiny one-step technical fixes where the issue title and result comment are enough.
- Do not expose secrets, tokens, API keys, MCP bearer values, or provider credentials in Git, issue comments, documents, Telegram, email, or logs.

## Workstreams

### 1. Agency Core Governance

Add a reusable document and annotation policy:

- when an issue must create a canonical issue document;
- when comments are sufficient;
- how reviewers use annotations;
- what "locked/frozen" means operationally;
- how Telegram/email should point to documents without duplicating full internal detail.

### 2. Astrogen Blog Pipeline

Apply the document policy to blog work:

- article brief document;
- validated draft document or canonical markdown artifact reference;
- layout handoff document;
- CMS delivery summary document;
- owner decision brief when approval is required.

After a step is accepted, the accepted document is frozen. Later corrections create a new revision document or a child issue, not a silent edit of the approved artifact.

### 3. SEO Performance Loop

Apply the document policy to SEO operations:

- weekly detailed SEO report is an issue/project document and email body;
- Telegram stays a compact digest;
- each material technical finding batch has a document-backed summary;
- per-URL tasks may use annotations for exact canonical/noindex/sitemap evidence when a reviewer needs to inspect the row.

### 4. Secret Configuration

Normalize plugin configuration language:

- plugin settings store secret refs, not secret material;
- company-scoped credentials are resolved by company/project context at execution time;
- UI configuration should use SecretBindingPicker-compatible fields where available;
- live/exported manifests record secret names/refs only.

## Acceptance Criteria

- Agency Core governance explicitly defines document-backed decisions, review annotations, and accepted-document locking.
- Astrogen production manifest says which blog/SEO artifacts must be documents.
- Astrogen live contracts instruct CMO/HIA to create owner-facing decision documents and avoid comment-only decision packets.
- Weekly SEO reporting contract says detailed reports are document/email artifacts and Telegram is only the short summary.
- Production plugin manifest states secret-ref and SecretBindingPicker-compatible configuration expectations.
- No plaintext secret value is added to Git.

## Verification

- Review diffs for scope and secret safety.
- Verify that no runtime/cache/secret-risk artifacts are staged.
- Optionally sync changed contract docs to the live Astrogen workspace after commit if production runtime does not already consume the Git repo directly.
