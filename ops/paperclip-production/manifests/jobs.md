# Production Scheduled Jobs Manifest

Last verified: 2026-06-08

| Plugin | Job key | Schedule | Expected status | Purpose |
| --- | --- | --- | --- | --- |
| `paperclip-plugin-telegram` | `check-escalation-timeouts` | `* * * * *` | active | Telegram escalation checks. |
| `paperclip-plugin-telegram` | `check-watches` | `*/15 * * * *` | active | Telegram watch notifications. |
| `paperclip.diskinternals-bigquery-growth` | `crawl-due-items` | `*/15 * * * *` | active | DiskInternals growth crawler. |
| `paperclip.seo-performance-loop` | `collect-weekly-search-telemetry` | `0 6 * * 3` | active | Weekly SEO telemetry collection after the GSC/GA4 data delay window. |
| `paperclip.seo-performance-loop` | `evaluate-weekly-seo-decisions` | `30 6 * * 3` | active | Weekly SEO decision evaluation after collection planning. |

## Forbidden Accidental Jobs

| Job key | Reason |
| --- | --- |
| `telegram-daily-digest` | Removed. Telegram should not send long duplicate digest-style issue completion text. |

## Review Rule

If a new job appears in production, add it here in the same commit as the code/config change that introduced it.
