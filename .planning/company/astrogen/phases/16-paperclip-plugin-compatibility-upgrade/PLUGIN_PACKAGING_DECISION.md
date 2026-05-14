# Plugin Packaging Decision

Date: 2026-05-14

## Decision

Use build-time inclusion of live Paperclip plugins in the production app image.

The candidate release image must contain the plugin package roots, workspace lockfile entries, built worker output, and server/runtime compatibility code before it is promoted to production.

## Rationale

This is the safest model for the current Paperclip deployment because:

- plugin dependency resolution is tested inside the final image layout;
- plugin manifests are validated before production boot;
- `@paperclipai/plugin-sdk` compatibility is compiled with the same server release;
- production does not depend on ad hoc `docker cp` operations after image build;
- the CTO release-check routine can reason from image labels and health provenance instead of container timestamps.

## Rejected Model

Runtime copying of legacy plugin folders into a release container is rejected for production. It was useful only as diagnostic evidence during the failed Phase 15 update attempt.

Reasons:

- it bypasses lockfile and workspace dependency validation;
- worker imports can accidentally depend on old `node_modules` state;
- manifest/runtime incompatibilities are found too late;
- it cannot provide deterministic release provenance.

## Temporary Compatibility Carry

Phase 16 carries a narrow compatibility bridge for legacy plugin code that calls:

```text
ctx.costs.createEvent(...)
```

The runtime permission is still mapped to the newer `metrics.write` capability. This keeps existing provider plugins bootable without broadening capability scope.

Sunset condition: remove the bridge after all live plugins migrate from `ctx.costs` to the current metrics/cost telemetry API.

## Production Promotion Requirement

Before production cutover, rebuild the image from the patched release source and repeat the same smoke checks:

- health with release provenance;
- `plugin-loader` `12/12` success;
- production DB migration check;
- Astrogen portal semantic-core endpoints;
- Telegram notification path check without duplicate staging bot activity.
