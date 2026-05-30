import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const pluginsDir = resolve(testDir, "../..");

const streamableHttpClients = [
  "plugin-search-console-mcp-agent-tools/src/search-console-mcp-client.ts",
  "plugin-perfex-crm-agent-tools/src/perfex-mcp-client.ts",
  "plugin-semantic-core-mcp-agent-tools/src/semantic-core-mcp-client.ts",
  "plugin-winning-structure-mcp-agent-tools/src/winning-structure-mcp-client.ts",
  "plugin-exa-agent-tools/src/exa-mcp-client.ts",
  "plugin-bright-data-agent-tools/src/bright-data-mcp-client.ts",
] as const;

describe("MCP streamable HTTP session cleanup", () => {
  it("explicitly terminates every SDK Streamable HTTP session before closing the client", () => {
    for (const relativePath of streamableHttpClients) {
      const source = readFileSync(resolve(pluginsDir, relativePath), "utf8");
      expect(source, relativePath).toContain("new StreamableHTTPClientTransport");
      expect(source, relativePath).toContain("transport.terminateSession()");
    }
  });
});
