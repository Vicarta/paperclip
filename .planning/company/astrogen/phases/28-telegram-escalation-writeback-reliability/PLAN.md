# Phase 28: Telegram Escalation Writeback Reliability

## Problem

Astrogen owner decision prompts can be resent when the first Telegram HIA prompt is not human-usable. The old prompt currently remains pending beside the corrected prompt. A reply to Telegram can also fail to become a canonical Paperclip issue comment, leaving the source issue blocked even though the owner answered.

## Goals

- A corrected escalation for the same source issue supersedes the previous pending escalation.
- Replies to active Telegram escalations are written back to the originating Paperclip issue before the escalation is marked resolved.
- Replies to superseded messages do not silently disappear.
- Timeout checks do not fire on obsolete escalations.

## Implementation

1. Extend Telegram escalation state with a `sourceIssueIdentifier` derived from the escalation text, plus `superseded` status metadata.
2. On escalation creation, supersede older pending escalations from the same company, agent, reason, and source issue.
3. Update pending-id handling to deduplicate IDs and remove superseded IDs.
4. On Telegram reply:
   - write a clear issue comment to the source issue when it can be resolved by identifier;
   - only then mark the escalation as resolved and edit the Telegram message;
   - fall back to existing native agent wake issue only when the source issue cannot be resolved.
5. Add tests for superseding and source-issue writeback.
6. Build/test the source package and deploy the updated plugin bundle to production.

## Acceptance Criteria

- Creating a second escalation for `[AST-926]` marks the first one `superseded` and removes it from `escalation_pending_ids`.
- A reply to the active escalation creates an issue comment on the source issue and resolves the escalation.
- A reply to a superseded message gets a human-readable Telegram response pointing to the newer prompt instead of doing nothing.
- Plugin tests pass and production plugin health remains ready after deployment.
