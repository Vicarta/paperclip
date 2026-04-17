import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadIssueArtifactViaApi, upsertIssueDocumentViaApi } from "./paperclip-issue-client.js";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("upsertIssueDocumentViaApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a document from scratch when no existing document is found", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET") {
        expect(url).toContain("/api/issues/issue-1/documents/plan");
        return new Response("", { status: 404 });
      }

      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        title: "Plan",
        format: "markdown",
        body: "Hello",
        changeSummary: "first write",
        baseRevisionId: null,
      });
      return jsonResponse(200, { ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);

    await upsertIssueDocumentViaApi({
      apiUrl: "https://paperclip.example",
      authToken: "token",
      runId: "run-1",
      issueId: "issue-1",
      key: "plan",
      title: "Plan",
      body: "Hello",
      changeSummary: "first write",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries with the latest revision id after a 409 conflict", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { latestRevisionId: "rev-1" }))
      .mockResolvedValueOnce(jsonResponse(409, { currentRevisionId: "rev-2" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    await upsertIssueDocumentViaApi({
      apiUrl: "https://paperclip.example",
      authToken: "token",
      runId: "run-1",
      issueId: "issue-1",
      key: "plan",
      title: "Plan",
      body: "Updated",
      changeSummary: "retry write",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const firstPut = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    const retryPut = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));

    expect(firstPut.baseRevisionId).toBe("rev-1");
    expect(retryPut.baseRevisionId).toBe("rev-2");
  });
});

describe("uploadIssueArtifactViaApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploads markdown artifacts through the issue attachments API", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://paperclip.example/api/companies/company-1/issues/issue-1/attachments");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer token",
        "X-Paperclip-Run-Id": "run-1",
      });
      expect(init?.body).toBeInstanceOf(FormData);
      const formData = init?.body as FormData;
      const file = formData.get("file");
      expect(file).toBeInstanceOf(File);
      expect((file as File).name).toBe("article.md");
      expect((file as File).type).toBe("text/markdown");
      expect(await (file as File).text()).toBe("# Hello");
      return jsonResponse(201, { id: "attachment-1" });
    });

    vi.stubGlobal("fetch", fetchMock);

    await uploadIssueArtifactViaApi({
      apiUrl: "https://paperclip.example",
      authToken: "token",
      runId: "run-1",
      companyId: "company-1",
      issueId: "issue-1",
      relativePath: "work/59-seo-blog-article-drafts/active/article.md",
      body: "# Hello",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
