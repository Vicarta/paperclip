#!/usr/bin/env node

console.error(
  [
    "Bulk OpenRouter/Claude harness fallback is disabled for Astrogen.",
    "Claude is allowed only for SEO Blog Article Writer (Claude).",
    "For Codex OAuth failures, pause execution and run the OpenAI reconnect procedure.",
  ].join(" "),
);
process.exit(1);
