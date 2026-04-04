---
title: Secrets Management
summary: Master key, encryption, and strict mode
---

Paperclip encrypts secrets at rest using a local master key. Agent environment variables that contain sensitive values (API keys, tokens) are stored as encrypted secret references.

## Default Provider: `local_encrypted`

Secrets are encrypted with a local master key stored at:

```
~/.paperclip/instances/default/secrets/master.key
```

This key is auto-created during onboarding. The key never leaves your machine.

## Configuration

### CLI Setup

Onboarding writes default secrets config:

```sh
pnpm paperclipai onboard
```

Update secrets settings:

```sh
pnpm paperclipai configure --section secrets
```

Validate secrets config:

```sh
pnpm paperclipai doctor
```

### Environment Overrides

| Variable | Description |
|----------|-------------|
| `PAPERCLIP_SECRETS_MASTER_KEY` | 32-byte key as base64, hex, or raw string |
| `PAPERCLIP_SECRETS_MASTER_KEY_FILE` | Custom key file path |
| `PAPERCLIP_SECRETS_STRICT_MODE` | Set to `true` to enforce secret refs |

## Strict Mode

When strict mode is enabled, sensitive env keys (matching `*_API_KEY`, `*_TOKEN`, `*_SECRET`) must use secret references instead of inline plain values.

```sh
PAPERCLIP_SECRETS_STRICT_MODE=true
```

Recommended for any deployment beyond local trusted.

## Migrating Inline Secrets

If you have existing agents with inline API keys in their config, migrate them to encrypted secret refs:

```sh
pnpm secrets:migrate-inline-env         # dry run
pnpm secrets:migrate-inline-env --apply # apply migration
```

## Secret References in Agent Config

Agent environment variables use secret references:

```json
{
  "env": {
    "ANTHROPIC_API_KEY": {
      "type": "secret_ref",
      "secretId": "8f884973-c29b-44e4-8ea3-6413437f8081",
      "version": "latest"
    }
  }
}
```

The server resolves and decrypts these at runtime, injecting the real value into the agent process environment.

## Third-Party Provider Keys In Plugin Settings

For plugin-managed third-party providers such as Serper, Bright Data, DataForSEO, and similar services:

- never store raw provider keys in frontend-visible config;
- never commit provider keys into repo-tracked files;
- store the plaintext only once in Company Secrets;
- keep only the secret reference in plugin config or other persisted settings;
- resolve the secret server-side at runtime.

If a plugin exposes operator settings for a third-party provider, prefer a custom settings page that:

- shows whether a secret is configured;
- allows replace-only rotation;
- persists only the secret ref, not the raw key.

## External Provider Cost Attribution

If a plugin calls a paid third-party provider, it should attribute that spend through Paperclip cost events when practical.

Recommended pattern:

- store an operator-managed marginal cost in plugin settings;
- emit provider-attributed cost events server-side;
- show those events in the Costs view alongside model-token costs.

This keeps external service spend visible without exposing provider credentials client-side.
