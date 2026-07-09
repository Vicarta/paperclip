# Phase 43: Artifact Registration Service

**Status:** Complete
**Created:** 2026-07-07
**Owner:** Paperclip platform / CTO lane

## Goal

Prevent article image/runtime agents from blocking completed work because they have a workspace file but cannot safely create a durable Paperclip work product.

## Problem

The current raw work-product endpoint correctly requires Paperclip artifact work products to reference an existing issue attachment through `metadata.attachmentId`. Image agents, however, naturally produce files inside the execution workspace. That leaves them guessing raw schemas or trying malformed `metadata.resourceRef` payloads, which caused AST-92 to block even though the cover image file exists and passed QA.

## System Decision

Implement this in Paperclip core/harness, not inside the image plugin.

Paperclip should provide a typed, attachment-first registration path:

1. Agent passes a relative workspace path and work-product metadata.
2. Server verifies issue/company/run/workspace ownership.
3. Server validates the file is inside the execution workspace.
4. Server stores it as an issue attachment.
5. Server creates a canonical `provider=paperclip`, `type=artifact` work product with `metadata.attachmentId`.
6. Repeated calls for the same issue/run/workspace/path return the existing registered product instead of duplicating attachments.

## Scope

- Add a server route for registering a current execution-workspace file as an attachment-backed artifact work product.
- Keep raw `POST /api/issues/:id/work-products` strict for Paperclip artifacts.
- Update artifact guidance so agents use the typed route/helper and do not handcraft Paperclip artifact schemas.
- Add tests for success, idempotency, and path traversal rejection.
- Deploy to `paperclip-astrogen-clean-app` only.
- Repair the current AST-92 blocker by registering its generated cover image without creating new issues.

## Acceptance

- AST-92 generated image can be registered as a durable attachment-backed work product.
- AST-86 can continue from the existing layout/image state rather than restarting article generation.
- A future image agent can complete with one typed registration call from a workspace-relative path.
- Raw workspace paths are not exposed as the durable artifact payload.
- Path traversal and absolute path input are rejected.
- Duplicate retries do not create duplicate work products.

## Verification

- Local focused tests pass:
  `pnpm --filter @paperclipai/server exec vitest run src/__tests__/workspace-artifact-registration.test.ts src/__tests__/issue-attachment-routes.test.ts`
  passed 22/22 tests.
- Server TypeScript build passes:
  `pnpm --filter @paperclipai/server build`.
- Clean app health is OK on `http://127.0.0.1:3210/api/health`.
- Deployed clean app image:
  `paperclip-app:v2026.626.0-vicarta.42-child-wait-not-blocker-20260707T0832Z`.
- Live recovery proof:
  - AST-92 generated cover image is registered as one accepted/primary
    attachment-backed Paperclip artifact work product.
  - AST-86 continued from the existing layout/image state.
  - AST-94 created CMS draft ID 119 and passed authenticated refetch.
  - CMO sent the final article-link Telegram notification and closed AST-86.

## Follow-up

- Add a higher-level route integration test for successful registration once the
  issue-route test harness can cheaply create execution/project workspace files.
- Keep raw `provider=paperclip` artifact creation strict; future image/runtime
  agents should use the typed registration route for workspace-generated
  deliverables.
