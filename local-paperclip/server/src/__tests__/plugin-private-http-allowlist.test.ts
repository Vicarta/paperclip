import { describe, expect, it } from "vitest";
import { isPrivatePluginFetchTargetAllowed } from "../services/plugin-host-services.js";

function allowed(pluginKey: string, url: string) {
  const parsedUrl = new URL(url);
  return isPrivatePluginFetchTargetAllowed({
    pluginKey,
    parsedUrl,
    hostname: parsedUrl.hostname,
  });
}

describe("plugin private HTTP allowlist", () => {
  it("allows only the Search Console MCP plugin to use the Docker bridge proxy", () => {
    expect(
      allowed(
        "paperclip.search-console-mcp-agent-tools",
        "http://172.21.0.1:3002/mcp",
      ),
    ).toBe(true);

    expect(
      allowed("paperclip.exa-agent-tools", "http://172.21.0.1:3002/mcp"),
    ).toBe(false);
  });

  it("keeps the exception exact by host and port", () => {
    expect(
      allowed(
        "paperclip.search-console-mcp-agent-tools",
        "http://172.21.0.1:3003/mcp",
      ),
    ).toBe(false);

    expect(
      allowed(
        "paperclip.search-console-mcp-agent-tools",
        "http://172.21.0.2:3002/mcp",
      ),
    ).toBe(false);
  });

  it("allows the canonical Tailscale MCP endpoint for the same trusted plugin", () => {
    expect(
      allowed(
        "paperclip.search-console-mcp-agent-tools",
        "http://100.98.5.50:3002/mcp",
      ),
    ).toBe(true);
  });

  it("allows only the Winning Structure MCP plugin to use its exact private endpoint", () => {
    expect(
      allowed(
        "paperclip.winning-structure-mcp-agent-tools",
        "http://100.98.5.50:8000/mcp",
      ),
    ).toBe(true);

    expect(
      allowed(
        "paperclip.search-console-mcp-agent-tools",
        "http://100.98.5.50:8000/mcp",
      ),
    ).toBe(false);

    expect(
      allowed(
        "paperclip.winning-structure-mcp-agent-tools",
        "http://100.98.5.50:8001/mcp",
      ),
    ).toBe(false);
  });

  it("allows only the Semantic Core MCP plugin to use its exact private endpoint", () => {
    expect(
      allowed(
        "paperclip.semantic-core-mcp-agent-tools",
        "http://100.98.5.50:8001/mcp",
      ),
    ).toBe(true);

    expect(
      allowed(
        "paperclip.winning-structure-mcp-agent-tools",
        "http://100.98.5.50:8001/mcp",
      ),
    ).toBe(false);

    expect(
      allowed(
        "paperclip.semantic-core-mcp-agent-tools",
        "http://100.98.5.50:8000/mcp",
      ),
    ).toBe(false);
  });
});
