import { afterEach, describe, expect, it } from "vitest";
import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { callGscBingGa4McpTool } from "../src/gsc-bing-ga4-mcp-client.js";

describe("GSC/Bing/GA4 MCP streamable HTTP sessions", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  });

  it("terminates the MCP session after a tool call", async () => {
    const requests: Array<{ method?: string; sessionId?: string }> = [];
    const sessionId = "test-session";

    server = http.createServer(async (req, res) => {
      requests.push({
        method: req.method,
        sessionId: Array.isArray(req.headers["mcp-session-id"])
          ? req.headers["mcp-session-id"][0]
          : req.headers["mcp-session-id"],
      });

      if (req.method === "DELETE") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("");
        return;
      }

      const body = await readJsonBody(req);
      if (body?.method === "initialize") {
        res.writeHead(200, {
          "content-type": "application/json",
          "mcp-session-id": sessionId,
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            serverInfo: { name: "fake-mcp", version: "1.0.0" },
          },
        }));
        return;
      }

      if (body?.method === "notifications/initialized") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("");
        return;
      }

      if (body?.method === "tools/call") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [{ type: "text", text: "ok" }],
            isError: false,
          },
        }));
        return;
      }

      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "unexpected request" } }));
    });

    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    const result = await callGscBingGa4McpTool({
      toolName: "sites_list",
      args: {},
      config: {
        gscBingGa4McpTokenSecretRef: "secret",
        gscBingGa4McpUrl: `http://127.0.0.1:${port}/mcp`,
      },
      resolveSecret: async () => "tenant-token",
    });

    expect(result.content).toBe("ok");
    expect(requests).toContainEqual({ method: "DELETE", sessionId });
  });
});

async function readJsonBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}
