# Semantic Core Operations

`docker-compose.provider-execution.override.yml` is the non-secret, persistent
server override that permits explicitly approved external provider operations.

Install it on the Semantic Core host as
`/opt/semantic-core/seo-semantic-core/docker-compose.override.yml`, then recreate
only `semantic-core-mcp`. It deliberately contains no provider credentials.

Paperclip remains independently constrained by its company-scoped Semantic Core
plugin settings. Enabling this server gate alone does not allow unbounded agent
calls.
