import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { execute } from "@paperclipai/adapter-openrouter/server";

function buildCtx(): AdapterExecutionContext {
  return {
    runId: "run_123",
    agent: {
      id: "agent_123",
      companyId: "company_123",
      name: "SEO Blog Article Writer",
      adapterType: "openrouter",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: "issue:test",
    },
    config: {
      model: "anthropic/claude-sonnet-4.6",
      env: {
        OPENROUTER_API_KEY: "or-key",
      },
      instructionsFilePath: "",
      promptTemplate: "Write the assigned article draft only.",
    },
    context: {
      paperclipCurrentIssueMarkdown: "## Current Paperclip Issue\n\n- Issue: AST-999 Test article",
      paperclipIssueId: "issue_123",
      paperclipIssueIdentifier: "AST-999",
    },
    authToken: "paperclip-jwt",
    onLog: async () => {},
    onMeta: async () => {},
  };
}

describe("openrouter direct adapter issue protocol", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PAPERCLIP_API_URL;
    delete process.env.PAPERCLIP_PUBLIC_URL;
    delete process.env.PAPERCLIP_LISTEN_HOST;
    delete process.env.PAPERCLIP_LISTEN_PORT;
    delete process.env.HOST;
    delete process.env.PORT;
  });

  it("writes an issue artifact file and lifecycle patch for issue-bound runs", async () => {
    process.env.PAPERCLIP_API_URL = "http://paperclip.test";
    const relativePath =
      "work/59-seo-blog-article-drafts/active/ast-152-money-ua-2026-04-07.md";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "anthropic/claude-sonnet-4.6",
            usage: { prompt_tokens: 120, completion_tokens: 240, cost: 0.0123 },
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "done",
                    comment:
                      "## Stage 59 draft ready\n\n- Saved the full article draft to the canonical markdown artifact.",
                    artifact: {
                      relativePath,
                      body: "# Draft\n\nBody",
                    },
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            relativePath,
            absolutePath: `/workspace/${relativePath}`,
            bytes: 14,
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "issue_123", status: "done" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(buildCtx());

    expect(result.exitCode).toBe(0);
    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe("anthropic/claude-sonnet-4.6");
    expect(result.billingType).toBe("api");
    expect(result.costUsd).toBeCloseTo(0.0123, 6);
    expect(result.summary).toContain("Stage 59 draft ready");
    expect(result.resultJson).toEqual(
      expect.objectContaining({
        provider: "openrouter",
        protocol: expect.objectContaining({
          applied: true,
          issueIdentifier: "AST-999",
          status: "done",
          artifact: expect.objectContaining({
            relativePath,
          }),
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://paperclip.test/api/issues/issue_123/artifacts/file");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer paperclip-jwt",
          "X-Paperclip-Run-Id": "run_123",
        }),
      }),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://paperclip.test/api/issues/issue_123");
  });

  it("prefers the internal Paperclip API URL over the public hostname for issue artifact callbacks", async () => {
    process.env.PAPERCLIP_PUBLIC_URL = "https://ubuntu-oc.tailbd4e1c.ts.net:4447";
    process.env.PORT = "3100";
    const relativePath =
      "work/59-seo-blog-article-drafts/active/ast-152-money-ua-2026-04-07.md";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "anthropic/claude-sonnet-4.6",
            usage: { prompt_tokens: 10, completion_tokens: 20, cost: 0.001 },
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "done",
                    comment: "Draft saved.",
                    artifact: {
                      relativePath,
                      body: "# Draft",
                    },
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ relativePath }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "issue_123", status: "done" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(buildCtx());

    expect(result.exitCode).toBe(0);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:3100/api/issues/issue_123/artifacts/file");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://localhost:3100/api/issues/issue_123");
  });
});
