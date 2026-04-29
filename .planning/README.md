# Multi-Company Planning Index

This `.planning` directory is intentionally split by scope.

## Canonical Layout

- `agency-core/` - reusable agency-level operating model, shared agent templates, shared plugin/adapter decisions, and non-client-specific Paperclip guidance.
- `company/astrogen/` - Astrogen-specific GSD state, roadmap, requirements, execution log, and Paperclip entity map.
- `company/diskinternals/` - DiskInternals-specific GSD state, roadmap, requirements, execution log, and Paperclip entity map.

## Rule

Do not write client-specific planning state into the root `.planning` directory.

Before updating GSD files, choose the company scope explicitly:

- Astrogen work goes to `.planning/company/astrogen/`.
- DiskInternals work goes to `.planning/company/diskinternals/`.
- Shared reusable templates or cross-client Paperclip architecture go to `.planning/agency-core/`.

The root directory is only a router/index for humans and agents.
