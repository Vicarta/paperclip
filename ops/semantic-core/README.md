# Semantic Core Operations

Semantic Core no longer has a global provider-execution environment toggle.
The MCP accepts provider-backed work only when a caller explicitly sends
`mode=provider`; credentials remain server-owned.

Paperclip independently constrains those calls through its company-scoped
Semantic Core plugin policy: exact bounded candidate batches, Standard queue,
and separate evidence-only parsing. Do not add a Compose override merely to
enable provider execution.
