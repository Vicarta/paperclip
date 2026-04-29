# Research: Operating Architecture

## Target Org Shape

```text
CEO
├── CMO (acting Growth PM)
│   ├── SEO lane
│   ├── MKT lane
│   ├── ADS lane
│   ├── CRO / funnel lane (proposed)
│   ├── Localization lane (proposed)
│   └── QA / Compliance lane (proposed or shared)
├── CTO
│   ├── Data / Analytics lane (proposed)
│   └── OPS Observability Agent
└── OPS Human Interaction Agent
```

## Data Flow

```text
GA4/GSC MCP reports
  -> Data contracts and QA
  -> Product and URL mapping
  -> Product Proxy Score / Page Action Score
  -> CMO backlog decisions
  -> Agent tasks
  -> Patches/PRs or recommendations
  -> QA and approval
  -> Release/indexing
  -> Follow-up telemetry
```

Later:

```text
GA4/GSC exports in BigQuery
  -> BigQuery marts
  -> Paperclip agent reports
  -> Same backlog and PR workflow
```

## Ownership Rules

- `CMO` owns backlog priority and acts as Growth PM.
- `CTO` owns data correctness, tracking, MCP/BigQuery integration, and attribution fixes.
- SEO owns blog content, semantic core, content refresh, article writing, and SEO validation.
- MKT owns market intelligence, audience segmentation, offer hypotheses, product discovery, and campaign/funnel planning.
- ADS owns paid ads copy and simulation critique only.
- OPS owns monitoring and human handoff.
- SOC is future owner for social content plan and should not be conflated with MKT blog roles.

## Approval Boundaries

Agents may prepare patches/PRs. Agents may not autonomously publish production changes, tracking changes, popup experiments, or indexation batches without the approved workflow from Phase 5.
