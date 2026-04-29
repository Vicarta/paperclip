export const type = "openrouter";
export const label = "OpenRouter";

export const models: Array<{ id: string; label: string }> = [];

export const agentConfigurationDoc = `# openrouter agent configuration

Adapter: openrouter

Use when:
- You want a direct external HTTP adapter to OpenRouter.
- You want provider-backed model execution without requiring a local CLI runtime on the Paperclip host.
- You want some agents to run on OpenRouter models while keeping agent orchestration inside Paperclip.

Don't use when:
- You need local CLI semantics, local tool execution, or filesystem-bound workflows (use a local adapter instead).
- You want Paperclip to discover models from a local CLI install.

Core fields:
- model (string, required): OpenRouter model id, for example openai/gpt-5.2
- instructionsFilePath (string, optional): absolute path to markdown instructions injected into the system prompt
- promptTemplate (string, optional): heartbeat prompt template
- bootstrapPromptTemplate (string, optional): prompt only for fresh/stateless runs
- timeoutSec (number, optional): request timeout in seconds

Optional provider fields:
- baseUrl (string, optional): defaults to https://openrouter.ai/api/v1
- appName (string, optional): used for X-OpenRouter-Title
- siteUrl (string, optional): used for HTTP-Referer
- maxCompletionTokens (number, optional): forwarded as max_completion_tokens
- temperature (number, optional): forwarded to OpenRouter
- reasoningEffort (string, optional): forwarded as reasoning.effort
- env (object, optional): environment variables or secret references; OPENROUTER_API_KEY is read from here

Required environment:
- OPENROUTER_API_KEY should be provided through adapterConfig.env, preferably via a company secret reference.

Notes:
- This adapter is stateless and executes via direct HTTPS calls to OpenRouter.
- It does not require local OpenCode, Claude, Codex, or Gemini CLIs on the Paperclip host.
- It is intended for prompt-based agents rather than local tool-using coding agents.
- For issue-bound Paperclip runs, the adapter can execute an explicit issue protocol response
  (issue document upsert + artifact write + lifecycle patch) using the run JWT; it is still not a general local tool runtime.
`;
