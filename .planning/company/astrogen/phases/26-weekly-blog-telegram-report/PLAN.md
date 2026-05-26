# Phase 26: Weekly Blog Telegram Report

## Goal

Create the first, compact weekly Astrogen blog/SEO report for Telegram.

The report must help the owner quickly see whether blog publishing and organic
traffic moved in the right direction this week compared with the previous week.

The detailed version belongs to a future dashboard phase and is intentionally
out of scope for this phase.

## Scope

In scope:

- define a recurring, owner-facing weekly Telegram report contract;
- compare the latest complete week with the previous complete week;
- include publishing, GSC, GA4, and indexing indicators when available;
- keep the message compact and Ukrainian;
- update Astrogen CMO and SEO Performance Analyst contracts;
- sync the contract to the live Paperclip Astrogen workspace;
- create the Paperclip routine/task that makes the report run operationally.

Out of scope:

- building the detailed dashboard UI;
- changing Google Search Console or GA4 ingestion internals;
- adding new database schema unless the existing plugin layer cannot persist the
  required weekly snapshots;
- sending spreadsheets or long files to Telegram.

## Telegram Report Contract

The report is a short weekly owner briefing, not an analytics dump.

Required window:

- last complete Monday-Sunday week in `Europe/Kiev`;
- compare against the immediately previous Monday-Sunday week;
- if GSC or GA4 data is delayed/incomplete, say that directly and use the latest
  complete comparable window.

Required KPIs:

- publishing:
  - new published blog articles this week;
  - ready CMS drafts, if available;
  - total known blog articles in the registry;
- search visibility from Google Search Console:
  - clicks;
  - impressions;
  - CTR;
  - average position;
  - week-over-week delta;
- blog engagement from GA4, when available:
  - organic blog sessions or users;
  - engaged sessions / engagement rate;
  - blog-to-product or important route clicks, when tracked;
- indexing:
  - indexed blog pages or indexed site pages if the plugin/GSC source can return
    a reliable count;
  - otherwise, sitemap submitted URL count and/or checked URL sample with a clear
    data-gap note;
- highlights:
  - 1-3 improving pages or queries;
  - 1-3 risks or pages that need watch;
- next actions:
  - 1-3 concrete actions for the coming week.

Telegram style:

- Ukrainian;
- short sentences;
- no internal stage names, run IDs, plugin names, raw workflow labels, or SQL/API
  details;
- no markdown tables;
- target length 900-1400 characters, hard cap 1800 characters;
- include exact dates for the compared weeks;
- do not invent missing values.

## Dashboard Follow-Up

The future detailed dashboard should include:

- per-article weekly trends;
- query/page matrices;
- content inventory state;
- indexed/submitted URL history;
- cluster and semantic-core coverage;
- low CTR opportunities;
- blog-to-product conversion paths;
- recommended actions with owner priority controls.

This phase only prepares the data vocabulary and compact Telegram output.

## Implementation Steps

1. Add `docs/process/69-weekly-blog-telegram-report.md` to the Astrogen contract
   repository.
2. Update CMO routing so weekly blog/SEO report work uses Stage 69 and delegates
   metric interpretation to SEO Performance Analyst where possible.
3. Update SEO Performance Analyst so it can produce a compact weekly aggregate
   summary from stored/plugin-owned snapshots without direct GSC/DB access.
4. Live-sync the new contract to `/home/paperclip/astrogen`.
5. Create or update an Astrogen Paperclip routine for the compact weekly
   Telegram report.
6. Smoke-check that the live workspace contains the new process doc and contract
   references.

## Acceptance Criteria

- A future weekly report can be generated without asking the owner to interpret
  internal Paperclip details.
- The Telegram text compares this week with last week.
- Missing GSC/GA4/indexing data is called out cleanly instead of guessed.
- The detailed dashboard remains a separate planned track.
- The live Astrogen workspace contains the Stage 69 contract.

## 2026-05-26 Correction Scope

Owner feedback on the first Telegram smoke report added these requirements:

- publishing counts must come from Payload CMS, not only from sitemap fallback;
- Telegram paragraphs must be separated by blank lines;
- blog-scoped Search Console and GA4 data must use the current MCP adapter before
  the report declares a data gap;
- indexing wording must be plain Ukrainian and include checked URL problems when
  Search Console exposes them;
- the old Search Console-only plugin must stay disabled after the GSC/GA4 MCP
  adapter is live.
