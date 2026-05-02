# Roadmap: Agency Core

## Overview

Agency Core contains reusable Paperclip operating-system assets that should work across client companies without Astrogen- or DiskInternals-specific assumptions.

## Phases

- [x] **Phase 1: Agent Execution Governance** - Define shared rules for parent/child issues, blockers, execution state, plugin usage, and human-facing updates.
- [ ] **Phase 2: SEO Ops Postgres Schema** - Design and implement the shared `seo_ops` Postgres schema for SEO Performance Loop state, including page discovery, GSC query evidence, semantic-core membership, keyword targets, rank tracking policy, and new-page opportunities.
- [x] **Phase 3: Runtime Silent-Noop Recovery And Telegram Operational Alerts** - Fail agent assignment runs that exit successfully without issue-side effects, notify humans in Telegram, and include agent attribution in human notifications.

## Current Next Step

Continue Phase 2 planning for the shared `seo_ops` Postgres schema. Separately recover the Astrogen [AST-708](/AST/issues/AST-708) validation lane, because Phase 3 confirmed the validator agent currently no-ops instead of producing a Stage 54 result.
