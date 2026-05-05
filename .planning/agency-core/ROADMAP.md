# Roadmap: Agency Core

## Overview

Agency Core contains reusable Paperclip operating-system assets that should work across client companies without Astrogen- or DiskInternals-specific assumptions.

## Phases

- [x] **Phase 1: Agent Execution Governance** - Define shared rules for parent/child issues, blockers, execution state, plugin usage, and human-facing updates.
- [x] **Phase 2: SEO Ops Postgres Schema** - Design and implement the shared `seo_ops` Postgres schema for SEO Performance Loop state, including page discovery, GSC query evidence, semantic-core membership, keyword targets, Serper-backed rank tracking policy/observations, AI visibility, and new-page opportunities.
- [x] **Phase 3: Runtime Silent-Noop Recovery And Telegram Operational Alerts** - Fail agent assignment runs that exit successfully without issue-side effects, notify humans in Telegram, and include agent attribution in human notifications.

## Current Next Step

Next reusable step: implement SEO Performance Loop ingestion/runners on top of `seo_ops`, starting with sitemap discovery, GSC query import, and Serper-backed rank collection. Separately recover the Astrogen [AST-708](/AST/issues/AST-708) validation lane, because Phase 3 confirmed the validator agent currently no-ops instead of producing a Stage 54 result.
