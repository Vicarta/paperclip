import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "../src/manifest.js";
import { TOOL_NAMES } from "../src/constants.js";
import { createDocFromHtml, replaceAllText } from "../src/google-drive-docs-client.js";

function serviceAccountJson(): string {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
  });
  return JSON.stringify({
    client_email: "paperclip-docs@example.iam.gserviceaccount.com",
    private_key: privateKey,
    token_uri: "https://oauth.example/token",
  });
}

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    arrayBuffer: async () => Buffer.from(JSON.stringify(data)).buffer,
  } as unknown as Response;
}

describe("plugin-google-drive-docs-agent-tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("declares the create-doc tool in the manifest", () => {
    expect(manifest.tools?.some((tool) => tool.name === TOOL_NAMES.createDocFromHtml)).toBe(true);
  });

  it("creates a Google Doc from safe HTML", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "doc-1",
          name: "Article",
          mimeType: "application/vnd.google-apps.document",
          webViewLink: "https://docs.google.com/document/d/doc-1/edit",
          parents: ["folder-1"],
        }),
      );

    const result = await createDocFromHtml(
      {
        config: {
          googleServiceAccountJsonSecretRef: "secret-google",
          defaultFolderId: "folder-1",
          allowedFolderIds: ["folder-1"],
        },
        resolveSecret: async () => serviceAccountJson(),
        fetchFn: fetchFn as unknown as typeof fetch,
      },
      {
        title: "Article",
        html: "<h1>Article</h1><p>Body</p>",
      },
    );

    expect(result.documentId).toBe("doc-1");
    expect(result.documentUrl).toBe("https://docs.google.com/document/d/doc-1/edit");
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "https://oauth.example/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(String(fetchFn.mock.calls[1][0])).toContain("uploadType=multipart");
    const uploadHeaders = fetchFn.mock.calls[1][1]?.headers as Headers;
    expect(uploadHeaders.get("Authorization")).toBe("Bearer token-1");
  });

  it("rejects folders outside the allowlist", async () => {
    await expect(
      createDocFromHtml(
        {
          config: {
            googleServiceAccountJsonSecretRef: "secret-google",
            allowedFolderIds: ["folder-1"],
          },
          resolveSecret: async () => serviceAccountJson(),
          fetchFn: vi.fn() as unknown as typeof fetch,
        },
        {
          title: "Article",
          html: "<p>Body</p>",
          folderId: "folder-2",
        },
      ),
    ).rejects.toThrow(/not allowed/);
  });

  it("rejects unsafe HTML", async () => {
    await expect(
      createDocFromHtml(
        {
          config: { googleServiceAccountJsonSecretRef: "secret-google" },
          resolveSecret: async () => serviceAccountJson(),
          fetchFn: vi.fn() as unknown as typeof fetch,
        },
        {
          title: "Article",
          html: "<script>alert(1)</script>",
        },
      ),
    ).rejects.toThrow(/Unsafe HTML/);
  });

  it("runs replaceAllText through Docs batchUpdate", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1" }))
      .mockResolvedValueOnce(jsonResponse({ replies: [{}] }));

    const result = await replaceAllText(
      {
        config: { googleServiceAccountJsonSecretRef: "secret-google" },
        resolveSecret: async () => serviceAccountJson(),
        fetchFn: fetchFn as unknown as typeof fetch,
      },
      {
        documentId: "doc-1",
        containsText: "{{TITLE}}",
        replaceText: "Final Title",
      },
    );

    expect(result).toEqual({ replies: [{}] });
    expect(String(fetchFn.mock.calls[1][0])).toContain("/documents/doc-1:batchUpdate");
    expect(JSON.parse(String(fetchFn.mock.calls[1][1]?.body))).toEqual({
      requests: [
        {
          replaceAllText: {
            containsText: { text: "{{TITLE}}", matchCase: false },
            replaceText: "Final Title",
          },
        },
      ],
    });
  });
});
