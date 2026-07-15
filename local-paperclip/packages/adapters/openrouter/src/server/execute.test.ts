import { afterEach, describe, expect, it, vi } from "vitest";
import { execute } from "./execute.js";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

function makeContext(overrides: Partial<AdapterExecutionContext> = {}): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Writer",
      adapterType: "openrouter",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: {
      model: "openai/gpt-5.2",
      env: { OPENROUTER_API_KEY: "or-key" },
      requireArtifactOnDone: true,
    },
    context: {
      paperclipIssueId: "issue-1",
      paperclipIssueIdentifier: "AST-999",
      paperclipCurrentIssueMarkdown: "# AST-999\n\nWrite the article.",
      paperclipWorkspace: { cwd: "/tmp/paperclip-openrouter-test" },
    },
    authToken: "run-token",
    onLog: vi.fn(async () => {}),
    onMeta: vi.fn(async () => {}),
    ...overrides,
  };
}

function openRouterResponse(content: string) {
  return new Response(JSON.stringify({
    model: "openai/gpt-5.2",
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenRouter execute issue protocol", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("blocks issue-bound done responses that omit required artifacts", async () => {
    vi.stubEnv("PAPERCLIP_API_URL", "https://paperclip.example");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openRouterResponse(JSON.stringify({
        status: "done",
        comment: "Draft complete.",
        document: null,
        artifact: null,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(makeContext());

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("artifact_required_on_done");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://paperclip.example/api/issues/issue-1");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PATCH",
      headers: expect.objectContaining({
        Authorization: "Bearer run-token",
        "X-Paperclip-Run-Id": "run-1",
      }),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      status: "blocked",
    });
  });

  it("blocks unparsable issue-bound responses with a diagnostic comment", async () => {
    vi.stubEnv("PAPERCLIP_API_URL", "https://paperclip.example");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openRouterResponse("Here is the draft without JSON."))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(makeContext({
      config: {
        model: "openai/gpt-5.2",
        env: { OPENROUTER_API_KEY: "or-key" },
      },
    }));

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("protocol_parse_error");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.status).toBe("blocked");
    expect(body.comment).toMatch(/not a human decision/i);
    expect(body.comment).toContain("Here is the draft without JSON.");
  });

  it("passes sanitized provider routing to OpenRouter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openRouterResponse("Plain assistant response."));
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(makeContext({
      authToken: undefined,
      context: {},
      config: {
        model: "z-ai/glm-5.2",
        env: { OPENROUTER_API_KEY: "or-key" },
        provider: {
          only: "cloudflare",
          order: ["cloudflare", "openrouter"],
          allow_fallbacks: false,
          require_parameters: true,
          data_collection: "deny",
          zdr: true,
          unknown_secretish_field: "do-not-forward",
        },
      },
    }));

    expect(result.exitCode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("z-ai/glm-5.2");
    expect(body.provider).toEqual({
      only: ["cloudflare"],
      order: ["cloudflare", "openrouter"],
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
  });

  it("rejects a declared pipeline transition when issue context has no native case ID", async () => {
    vi.stubEnv("PAPERCLIP_API_URL", "https://paperclip.example");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openRouterResponse(JSON.stringify({
        status: "done",
        comment: "Done.",
        pipelineTransition: {
          toStageKey: "validate",
          reason: "Invalid test transition.",
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(makeContext({
      config: {
        model: "openai/gpt-5.2",
        env: { OPENROUTER_API_KEY: "or-key" },
        requireArtifactOnDone: false,
      },
    }));

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("pipeline_case_missing");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://paperclip.example/api/issues/issue-1");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ status: "blocked" });
  });

  it("commits a native pipeline transition before marking an OpenRouter stage done", async () => {
    vi.stubEnv("PAPERCLIP_API_URL", "https://paperclip.example");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openRouterResponse(JSON.stringify({
        status: "done",
        comment: "Canonical draft is ready.",
        document: null,
        artifact: {
          relativePath: "work/59-seo-blog-article-drafts/active/native-pipeline.md",
          body: "# Draft",
        },
        pipelineTransition: {
          toStageKey: "validate",
          reason: "Attachment-backed canonical draft registered.",
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "attachment-1" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        case: { id: "11111111-1111-4111-8111-111111111111", version: 8 },
        stage: { key: "draft" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ case: { version: 9 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(makeContext({
      context: {
        paperclipIssueId: "issue-1",
        paperclipIssueIdentifier: "AST-999",
        paperclipCurrentIssueMarkdown: [
          "# AST-999",
          "",
          "### Technical Context",
          "- case_id: 11111111-1111-4111-8111-111111111111",
        ].join("\n"),
        paperclipWorkspace: { cwd: "/tmp/paperclip-openrouter-test" },
      },
    }));

    expect(result.exitCode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://paperclip.example/api/cases/11111111-1111-4111-8111-111111111111",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "https://paperclip.example/api/cases/11111111-1111-4111-8111-111111111111/transition",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toMatchObject({
      toStageKey: "validate",
      expectedVersion: 8,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body))).toMatchObject({ status: "done" });
  });
});
