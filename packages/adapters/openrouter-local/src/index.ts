export const type = "openrouter_local";
export const label = "OpenCode + OpenRouter (local)";

export const models: Array<{ id: string; label: string }> = [];

export const agentConfigurationDoc = `# openrouter_local agent configuration

Adapter: openrouter_local

Use when:
- You want OpenCode local runtime semantics, but constrained to OpenRouter-backed models
- You have OpenCode CLI installed on the Paperclip host
- You want provider/model routing in OpenCode format, limited to openrouter/*

Don't use when:
- You need non-OpenRouter providers in one adapter (use opencode_local)
- You need a direct external HTTP adapter to OpenRouter
- OpenCode CLI is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process
- instructionsFilePath (string, optional): absolute path to markdown instructions prepended to the run prompt
- model (string, required): OpenRouter model id in provider/model format, for example openrouter/openai/gpt-5
- variant (string, optional): provider-specific reasoning level (minimal|low|medium|high|max)
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "opencode"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables or secret references

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Required environment:
- OPENROUTER_API_KEY should be provided through Paperclip company secrets, preferably via company-level adapter settings

Notes:
- This adapter is a thin first-class wrapper over OpenCode local execution.
- Model discovery is filtered to openrouter/* entries only.
- Paperclip requires an explicit openrouter/* model value for openrouter_local agents.
- This is not the future direct HTTP OpenRouter adapter. It still shells out to local OpenCode CLI.
`;
