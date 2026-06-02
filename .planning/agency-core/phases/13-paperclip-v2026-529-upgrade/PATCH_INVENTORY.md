# Local Patch Inventory For v2026.529.0 Upgrade

Generated: 2026-06-02

Scope: local commits on `codex/upstream-v2026.403.0-convergence` after `v2026.403.0`.

Target upstream: `v2026.529.0` (`911a1e8b0d24205acd5006e837a5c5e8c4bfb447`).

Important: this is the first-pass inventory gate. Decisions marked `review against upstream` or `port required` must be verified in the upgrade worktree before code is ported.

## Summary

| Decision | Count |
| --- | ---: |
| manual review | 8 |
| planning/ops only | 93 |
| port required | 72 |
| review against upstream | 40 |

## Upgrade Worktree

Created upgrade worktree:

`/Users/savitsky/CodexProjects/paperclip-v2026.529.0-upgrade`

Branch: `codex/paperclip-v2026.529.0-upgrade`

Base: `v2026.529.0`

## Porting Rules

- Do not merge the old convergence branch directly into the upgrade branch.
- Port one feature area per commit.
- Prefer upstream implementation when it fully covers our local behavior.
- Keep planning and production overlay docs outside the upstream app source.
- Preserve Telegram, Payload CMS, MCP session close, SEO Ops, and agent wakeup behavior unless an upstream feature is proven equivalent by smoke tests.

## Full Commit Inventory

| # | Commit | First-pass decision | Subject | Notes |
| ---: | --- | --- | --- | --- |
| 1 | `be8707cb` | planning/ops only | docs: add DB reconciliation worksheet for v2026.403.0 | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 2 | `faf0c628` | planning/ops only | docs: add DB convergence runbook for v2026.403.0 | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 3 | `2939bfc5` | planning/ops only | docs: define preflight schema bridge for DB convergence | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 4 | `1fceafdf` | planning/ops only | docs: add DB probe scripts for convergence | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 5 | `c9ee8dcf` | review against upstream | test: rehearse legacy USD schema convergence | Likely code/runtime change; classify manually during port. |
| 6 | `552a2303` | manual review | Converge Paperclip onto upstream v2026.403.0 | Needs human/code review classification. |
| 7 | `fcde4aef` | review against upstream | Fix live agent plugin tool execution after cutover | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 8 | `f45be93b` | review against upstream | Allow longer host timeouts for long-running plugin tools | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 9 | `5b8e51be` | planning/ops only | Document Bright Data smoke and manifest refresh step | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 10 | `440b21b4` | review against upstream | Add bundled plugin manifest refresh tooling | Likely code/runtime change; classify manually during port. |
| 11 | `b43a56d1` | port required | Harden bundled plugin manifest and cost traceability | SEO Ops schema/plugin/reporting functionality must survive. |
| 12 | `587c3a78` | planning/ops only | Document Bright Data billing probe limits | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 13 | `fae60438` | planning/ops only | Plan Bright Data deferred cost reconciliation | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 14 | `e13e885a` | port required | Add Bright Data cost reconciliation tool | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 15 | `dbba1140` | port required | Make Bright Data reconciler production-safe CLI | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 16 | `9a09511a` | port required | Stabilize Bright Data reconciler operator path | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 17 | `6f837137` | planning/ops only | Record live Bright Data reconciler bootstrap | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 18 | `fb88860d` | review against upstream | Fix post-cutover issue and document revision paths | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 19 | `bf734eee` | review against upstream | fix(scheduler): pause plugin jobs without handlers | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 20 | `48101184` | planning/ops only | docs(telegram): require image delivery as documents | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 21 | `6ab1fd05` | review against upstream | fix(issues): sync human decision label lifecycle | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 22 | `3d7697d4` | port required | feat(issues): deliver notification contract attachments | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 23 | `01e1b20b` | review against upstream | fix(heartbeat): follow active issue runs | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 24 | `0b4d171c` | review against upstream | feat(openrouter): persist issue artifacts | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 25 | `046102dd` | port required | feat(plugins): add seo performance loop baseline | SEO Ops schema/plugin/reporting functionality must survive. |
| 26 | `428c1885` | manual review | chore(deploy): harden post-cutover operations | Needs human/code review classification. |
| 27 | `0f2346be` | port required | Harden Bright Data Instagram resolver | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 28 | `f4f299b8` | port required | Add DataForSEO keyword expansion tool | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 29 | `1be595f0` | review against upstream | Install jq in Paperclip runtime image | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 30 | `c214f5bc` | port required | Humanize Telegram document delivery captions | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 31 | `45a19bf5` | port required | Avoid raw English titles in Telegram captions | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 32 | `a823084c` | port required | Show task title and completion summary in Telegram | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 33 | `8228aa69` | review against upstream | Bound heartbeat run list queries | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 34 | `7bbe54e0` | review against upstream | Add gpt-5.5 to Codex local models | Likely code/runtime change; classify manually during port. |
| 35 | `28513cfc` | port required | Add Search Console MCP plugin | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 36 | `b7596a78` | port required | Allow Search Console MCP private bridge fetch | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 37 | `2920b69d` | port required | Humanize Telegram issue notifications | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 38 | `d5e97430` | review against upstream | Move Paperclip source under workspace root | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 39 | `950a79d7` | planning/ops only | Add agency workspace planning root | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 40 | `cc112caa` | review against upstream | Ignore local workspace temp artifacts | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 41 | `766dbadb` | port required | Add Winning Structure MCP plugin | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 42 | `e0eb36bf` | port required | Allow Winning Structure MCP private endpoint | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 43 | `fe97eac2` | port required | Normalize Winning Structure MCP payloads | Astrogen blog/CMS production flow depends on this. |
| 44 | `40f6dd3d` | port required | Add Semantic Core MCP plugin | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 45 | `7f9c281e` | planning/ops only | Document Semantic Core review queue support | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 46 | `1a98525e` | planning/ops only | Restore Astrogen planning context | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 47 | `8822b50f` | port required | Fix DiskInternals workspace and semantic core flow | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 48 | `9507670b` | port required | Add DiskInternals semantic core handoff guardrail | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 49 | `c6a84f5a` | planning/ops only | Record DiskInternals semantic core completion | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 50 | `72653419` | port required | Normalize Semantic Core MCP project configs | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 51 | `cbb43359` | planning/ops only | Record DiskInternals semantic core rerun | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 52 | `fbea7682` | port required | Humanize Telegram issue completion captions | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 53 | `621a9772` | planning/ops only | Document Telegram plugin issue-done hotfix | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 54 | `bd7b3473` | port required | Fix semantic core MCP payload normalization | Astrogen blog/CMS production flow depends on this. |
| 55 | `dc7c49d4` | planning/ops only | Update semantic core MCP contract | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 56 | `f1c7fa08` | port required | Add semantic core MCP direct-args fallback | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 57 | `f753ce2b` | port required | Humanize semantic core Telegram completions | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 58 | `6956853c` | port required | Fix semantic core MCP keyword flow | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 59 | `cef334ac` | review against upstream | Add Astrogen growth strategy architect planning | Likely code/runtime change; classify manually during port. |
| 60 | `1baf9448` | planning/ops only | docs: add agent execution governance | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 61 | `7aec2daa` | planning/ops only | docs: apply DiskInternals execution governance overlay | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 62 | `e431aad2` | planning/ops only | docs: add seo performance loop proposal | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 63 | `4d4ae881` | planning/ops only | docs: define DiskInternals BigQuery growth algorithm | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 64 | `3afeb94b` | port required | feat: add gsc bing ga4 mcp plugin | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 65 | `a22b4716` | planning/ops only | docs: plan DiskInternals BigQuery growth implementation | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 66 | `6103854c` | port required | fix: expand gsc bing ga4 mcp allowlist | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 67 | `72e67eb3` | review against upstream | feat: add DiskInternals BigQuery growth plugin | Likely code/runtime change; classify manually during port. |
| 68 | `a425fb60` | review against upstream | fix: separate DiskInternals BigQuery source datasets | Likely code/runtime change; classify manually during port. |
| 69 | `0c5dd956` | planning/ops only | ops: bootstrap DiskInternals BigQuery growth | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 70 | `9640c711` | planning/ops only | docs: plan seo ops postgres schema | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 71 | `a1737be9` | planning/ops only | docs: prevent silent delegated issue stalls | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 72 | `9ebc7cd7` | planning/ops only | docs: add child recovery race guard | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 73 | `bb2891da` | planning/ops only | docs: keep human decisions on source issues | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 74 | `d06ea132` | planning/ops only | docs: record Astrogen backlog cleanup | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 75 | `3186fea6` | planning/ops only | docs: refresh DiskInternals roadmap status | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 76 | `0acdb784` | planning/ops only | docs: clear stale Astrogen human gates | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 77 | `21e287d9` | planning/ops only | docs: prevent duplicate HIA human gates | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 78 | `2f4abea8` | review against upstream | feat: complete DiskInternals growth readiness | Likely code/runtime change; classify manually during port. |
| 79 | `8f153ffd` | planning/ops only | docs: plan DiskInternals Perfex handoff | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 80 | `bc21f145` | review against upstream | feat: add DiskInternals Perfex CRM handoff plugin | Likely code/runtime change; classify manually during port. |
| 81 | `757f8c66` | planning/ops only | docs: record Astrogen control gate recovery | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 82 | `767f1dfa` | planning/ops only | docs: keep manager parents out of false human gates | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 83 | `cd764ac5` | review against upstream | feat: normalize DiskInternals Perfex handoff routing | Likely code/runtime change; classify manually during port. |
| 84 | `eca555be` | planning/ops only | docs: update DiskInternals Phase 11 roadmap status | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 85 | `6daf8857` | planning/ops only | docs: record Astrogen route permission recovery | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 86 | `989b412b` | review against upstream | feat: complete DiskInternals Perfex follow-up handoff | Likely code/runtime change; classify manually during port. |
| 87 | `6ed3264a` | planning/ops only | docs: add company workspace permission policy | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 88 | `346946e3` | port required | feat: add DiskInternals guide and Telegram summaries | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 89 | `d8a89bca` | planning/ops only | docs: add Ukrainian DiskInternals Paperclip guide | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 90 | `620cc4b8` | review against upstream | Add runtime silent-noop recovery alerts | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 91 | `e3a218ca` | planning/ops only | Update Astrogen semantic core recall guidance | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 92 | `c12b641d` | port required | feat: support semantic core competitor recall config | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 93 | `53c5da58` | planning/ops only | docs: align semantic core MCP operating rules | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 94 | `3ba5036a` | port required | Prevent semantic core run-layer config no-op | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 95 | `1c3b0b3b` | planning/ops only | Plan SEO ops schema for Serper-backed rank tracking | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 96 | `b641db55` | port required | Sync semantic core agent guide with MCP policy updates | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 97 | `c2f175ee` | port required | feat: align semantic core decision policy | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 98 | `53716ba2` | port required | Implement SEO ops Postgres schema | SEO Ops schema/plugin/reporting functionality must survive. |
| 99 | `b809f2a2` | port required | Harden semantic core import artifact validation | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 100 | `ced085b8` | planning/ops only | Document semantic core review escalation guardrails | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 101 | `e6d7b149` | planning/ops only | Document Astrogen semantic core layer 2 status | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 102 | `96d553e0` | port required | Add Astrogen handoff for semantic core continuation | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 103 | `22b84d70` | planning/ops only | docs: add DiskInternals branch transfer handoff | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 104 | `6fc1a458` | planning/ops only | Document Astrogen layer 2 policy fix | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 105 | `c1891a2f` | planning/ops only | Update semantic core review gating | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 106 | `82bbbee7` | port required | feat(astrogen): persist semantic core review workflow | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 107 | `37604d80` | planning/ops only | docs(astrogen): define seo blog content waves | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 108 | `fe06d25b` | planning/ops only | docs(astrogen): refresh roadmap current state | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 109 | `82cb2a1e` | planning/ops only | docs(astrogen): record live phase 14 contract update | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 110 | `a6e10aa2` | planning/ops only | docs(astrogen): plan paperclip server release update | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 111 | `58bb3574` | planning/ops only | docs(astrogen): record paperclip update rollback | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 112 | `81d9cfaa` | planning/ops only | docs(astrogen): plan paperclip plugin compatibility gate | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 113 | `ac151541` | planning/ops only | docs(astrogen): record paperclip plugin upgrade | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 114 | `99fa5a55` | planning/ops only | docs(astrogen): record release check follow-up | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 115 | `a7b19fb6` | port required | fix: shorten telegram issue notifications | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 116 | `ae4248cd` | port required | fix: use single telegram notification path | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 117 | `5aa8ad9e` | planning/ops only | docs(astrogen): plan plugin standardization and recovery boundaries | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 118 | `af0a43ea` | manual review | chore(astrogen): execute plugin standardization pass | Needs human/code review classification. |
| 119 | `56510872` | review against upstream | fix: clean server build output before compile | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 120 | `28deae88` | planning/ops only | chore(ops): add paperclip production config source of truth | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 121 | `6e183ea0` | planning/ops only | docs: remove local secret file path from plugin docs | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 122 | `5d705473` | planning/ops only | docs: sanitize local operator paths | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 123 | `565aa805` | planning/ops only | Document Astrogen owner decision brief contract | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 124 | `41c57def` | planning/ops only | Plan Astrogen blog page registry monitor | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 125 | `95e263ae` | manual review | Track Astrogen Wave 1 draft validation | Needs human/code review classification. |
| 126 | `1d3c3f52` | planning/ops only | Record Astrogen draft revalidation blocker | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 127 | `ceaee679` | planning/ops only | Document Telegram issue done human summary fix | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 128 | `c845edf7` | planning/ops only | Record Astrogen article recovery reruns | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 129 | `d103f59d` | planning/ops only | Plan Astrogen article writer fallback policy | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 130 | `c07c1504` | review against upstream | Clarify article recovery uses runtime guard | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 131 | `f548bd2f` | planning/ops only | Document Astrogen writer fallback recovery | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 132 | `7db91fc7` | planning/ops only | Record Astrogen recovery status cleanup | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 133 | `31a2b7e7` | review against upstream | Fix issue artifact links opening in Files | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 134 | `711a9cc6` | review against upstream | Make issue inline file paths open in Files | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 135 | `f4774163` | review against upstream | Use company project fallback for issue file links | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 136 | `069b0664` | review against upstream | Fix OpenRouter issue protocol and skills support | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 137 | `cba58937` | planning/ops only | Document OpenRouter production runtime | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 138 | `f14d7977` | planning/ops only | Document OpenRouter writer prompt template policy | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 139 | `0616ce86` | planning/ops only | Document Astrogen blog image delivery recovery | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 140 | `32bc6cae` | planning/ops only | Plan Telegram attachment delivery groups | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 141 | `2701c4aa` | port required | Implement Telegram attachment delivery groups | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 142 | `cb90bdd6` | port required | Log Astrogen cover image Telegram delivery | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 143 | `158d764e` | port required | Add Payload CMS agent tools plugin | Astrogen blog/CMS production flow depends on this. |
| 144 | `317a30f0` | port required | Bundle Payload CMS plugin in production image | Astrogen blog/CMS production flow depends on this. |
| 145 | `25c38788` | planning/ops only | Document Payload CMS production cutover | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 146 | `efc41ff2` | review against upstream | Reconcile secret metadata schema | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 147 | `8d9e11aa` | planning/ops only | Record secret schema production cutover | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 148 | `8cc0cd79` | planning/ops only | Document Telegram CMS draft classification fix | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 149 | `078767a4` | planning/ops only | Document Astrogen CMO blog scope rule | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 150 | `a6b7ef07` | planning/ops only | Plan provider cost accounting ledger | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 151 | `dbc1fadc` | port required | Add provider cost accounting ledger | SEO Ops schema/plugin/reporting functionality must survive. |
| 152 | `b50106cf` | port required | Accumulate sub-cent Serper costs | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 153 | `07f86adf` | review against upstream | Implement fast blog production loop wakeups | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 154 | `2d867233` | planning/ops only | Record phase 10 production cutover | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 155 | `599a674c` | port required | Add Astrogen blog layout pipeline | Astrogen blog/CMS production flow depends on this. |
| 156 | `a5a20cf9` | planning/ops only | Record Astrogen layout pipeline deployment | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 157 | `457e13a3` | manual review | Tighten Astrogen layout agent closeout rules | Needs human/code review classification. |
| 158 | `8c63211d` | port required | Fix Telegram completion noise | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 159 | `72853df1` | port required | Fix Telegram delivery contract runtime parser | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 160 | `91e11e8c` | port required | Tighten Astrogen article layout CTA policy | Astrogen blog/CMS production flow depends on this. |
| 161 | `1332a25c` | port required | Align Astrogen layout contracts with Payload schema | Astrogen blog/CMS production flow depends on this. |
| 162 | `b52d0a5a` | port required | Tighten Astrogen cover image policy | Astrogen blog/CMS production flow depends on this. |
| 163 | `3e862fff` | planning/ops only | Record Phase 23 Telegram proof closeout | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 164 | `9b9c2815` | planning/ops only | Record Chinese horoscope CTA follow-up | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 165 | `7bb3a2c1` | planning/ops only | Record Telegram plugin cutover gap | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 166 | `2472361e` | port required | Complete Telegram plugin production cutover | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 167 | `5379716c` | manual review | Tighten Astrogen article image quality contracts | Needs human/code review classification. |
| 168 | `caf03e3c` | port required | Add Astrogen LLM heartbeat cost controls | SEO Ops schema/plugin/reporting functionality must survive. |
| 169 | `021d46b6` | planning/ops only | Record Astrogen heartbeat cost-control deployment | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 170 | `ef275c9d` | review against upstream | Add Astrogen cover metadata contract | Likely code/runtime change; classify manually during port. |
| 171 | `ce7c9c60` | port required | Add Payload article iconList block | Astrogen blog/CMS production flow depends on this. |
| 172 | `101e64b1` | planning/ops only | Record Astrogen iconList adapter deployment | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 173 | `3612d9fa` | planning/ops only | Record Astrogen iconList CMS smoke test | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 174 | `ed4ba12b` | manual review | Limit illustrated lists in Astrogen layout contract | Needs human/code review classification. |
| 175 | `e2022dc2` | planning/ops only | Record Astrogen no-heartbeat article pipeline smoke | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 176 | `cd2d9aac` | review against upstream | Promote Astrogen ChatGPT writer to primary | Likely code/runtime change; classify manually during port. |
| 177 | `99235269` | port required | Reject raw article URLs in Payload content | Astrogen blog/CMS production flow depends on this. |
| 178 | `90ad7e27` | manual review | Tighten Astrogen product link contract | Needs human/code review classification. |
| 179 | `29850fcb` | review against upstream | Block dangling next-step article copy | Likely code/runtime change; classify manually during port. |
| 180 | `c4596e2a` | review against upstream | Require free offer labels in Astrogen article links | Likely code/runtime change; classify manually during port. |
| 181 | `9925d3b5` | port required | Add Telegram delivery proof ledger | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 182 | `a9c726cd` | port required | Tighten Astrogen human cover image contract | Astrogen blog/CMS production flow depends on this. |
| 183 | `18ef4a7e` | planning/ops only | Record Astrogen live cover contract sync | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 184 | `2fb0b810` | planning/ops only | Record Astrogen article content contract sync | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 185 | `ab705efa` | planning/ops only | Record Astrogen CMS-only Telegram delivery contract | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 186 | `998d96af` | planning/ops only | Record Astrogen cover device and emotion rules | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 187 | `110cea3d` | planning/ops only | Plan Astrogen weekly blog Telegram report | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 188 | `3ff68a7a` | port required | Add message-only Telegram notifications | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 189 | `30d7a8b7` | port required | Wire Astrogen weekly report data adapters | SEO Ops schema/plugin/reporting functionality must survive. |
| 190 | `36d21aed` | port required | Expose GSC inspection cache tools | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 191 | `d14de363` | planning/ops only | Record Astrogen indexing auditor setup | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 192 | `15695363` | port required | Expose GSC async inspection job tools | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 193 | `259f0182` | port required | Add SEO indexing snapshots and page findings | SEO Ops schema/plugin/reporting functionality must survive. |
| 194 | `a334f5fe` | port required | Allow GA4 funnel and page analysis MCP tools | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 195 | `0198dd59` | port required | Map page analysis MCP scoped arguments | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 196 | `1415fdac` | review against upstream | Harden actionable issue wakeups | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 197 | `a27e0752` | review against upstream | Fix reassigned queued issue locks | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 198 | `ed4aedc7` | review against upstream | Ignore orphaned deferred issue wakeups | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 199 | `71419828` | review against upstream | Remove legacy SEO review UI | Likely code/runtime change; classify manually during port. |
| 200 | `7bc4a4e3` | port required | Fix Telegram escalation writeback | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 201 | `127e2332` | port required | Route Telegram escalation replies before thread sessions | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 202 | `fe238c5e` | port required | Suppress internal Telegram done fallbacks | Preserve current Telegram owner-facing behavior unless upstream fully replaces it. |
| 203 | `2ad51829` | port required | Raise GSC MCP inspection timeout | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 204 | `ac9b3b63` | review against upstream | Fix plugin comment wakeups | May overlap with v2026.529 workspace/recovery/runtime changes; compare before porting. |
| 205 | `c7495c9b` | port required | Add CrawlObserver agent tools plugin | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 206 | `8661d8c3` | review against upstream | Add Astrogen dynamic product route delivery phase | Likely code/runtime change; classify manually during port. |
| 207 | `1de49476` | port required | fix: close gsc mcp sessions after plugin calls | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 208 | `f04b23ed` | port required | Fix Payload CMS route taxonomy delivery | Astrogen blog/CMS production flow depends on this. |
| 209 | `ec1b978f` | port required | Terminate MCP streamable HTTP sessions | Provider/MCP/plugin functionality must be checked against upstream plugin SDK and retained or replaced. |
| 210 | `d80d3c88` | planning/ops only | Plan Astrogen SEO continuation and GSC unblock | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 211 | `426388b2` | planning/ops only | Plan Astrogen image runtime executor settings | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 212 | `324db68f` | planning/ops only | Plan Astrogen SEO blog humanizer workflow | Keep in .planning/ops/company contract overlay, not upstream app source. |
| 213 | `92643a5b` | planning/ops only | Plan Paperclip v2026.529.0 upgrade\n\nCo-Authored-By: Paperclip <noreply@paperclip.ing> | Phase 13 planning already in overlay. |
