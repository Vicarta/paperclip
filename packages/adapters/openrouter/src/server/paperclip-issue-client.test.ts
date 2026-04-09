import { afterEach, describe, expect, it, vi } from "vitest";
import { upsertIssueDocumentViaApi } from "./paperclip-issue-client.js";

describe("upsertIssueDocumentViaApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a document without baseRevisionId when the document does not exist", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Document not found" }), { status: 404 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ latestRevisionId: "rev-1" }), { status: 201 }),
      );

    await upsertIssueDocumentViaApi({
      apiUrl: "http://paperclip.local",
      authToken: "token",
      runId: "run-1",
      issueId: "issue-1",
      key: "draft",
      title: "Title",
      body: "# body",
      changeSummary: "create",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        title: "Title",
        format: "markdown",
        body: "# body",
        changeSummary: "create",
        baseRevisionId: null,
      }),
    });
  });

  it("updates a document using the latestRevisionId from the existing document", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ latestRevisionId: "rev-10" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ latestRevisionId: "rev-11" }), { status: 200 }),
      );

    await upsertIssueDocumentViaApi({
      apiUrl: "http://paperclip.local",
      authToken: "token",
      runId: "run-1",
      issueId: "issue-1",
      key: "draft",
      title: "Title",
      body: "# body",
      changeSummary: "update",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        title: "Title",
        format: "markdown",
        body: "# body",
        changeSummary: "update",
        baseRevisionId: "rev-10",
      }),
    });
  });

  it("retries once on 409 using the currentRevisionId returned by Paperclip", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ latestRevisionId: "rev-10" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Document was updated by someone else", currentRevisionId: "rev-11" }), { status: 409 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ latestRevisionId: "rev-12" }), { status: 200 }),
      );

    await upsertIssueDocumentViaApi({
      apiUrl: "http://paperclip.local",
      authToken: "token",
      runId: "run-1",
      issueId: "issue-1",
      key: "draft",
      title: "Title",
      body: "# body",
      changeSummary: "retry",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        title: "Title",
        format: "markdown",
        body: "# body",
        changeSummary: "retry",
        baseRevisionId: "rev-10",
      }),
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        title: "Title",
        format: "markdown",
        body: "# body",
        changeSummary: "retry",
        baseRevisionId: "rev-11",
      }),
    });
  });
});
