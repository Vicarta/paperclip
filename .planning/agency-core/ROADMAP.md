# Roadmap: Agency Core

## Overview

Agency Core contains reusable Paperclip operating-system assets that should work across client companies without Astrogen- or DiskInternals-specific assumptions.

## Phases

- [x] **Phase 1: Agent Execution Governance** - Define shared rules for parent/child issues, blockers, execution state, plugin usage, and human-facing updates.
- [ ] **Phase 2: SEO Ops Postgres Schema** - Design and implement the shared `seo_ops` Postgres schema for SEO Performance Loop state, including page discovery, GSC query evidence, semantic-core membership, keyword targets, rank tracking policy, and new-page opportunities.

## Current Next Step

Plan Phase 2 before writing DB migrations. The plan must preserve multi-company and multi-project isolation while allowing operational joins with Paperclip companies, projects, issues, costs, plugin runs, and agent workflows.
