import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  buildBlogPostPayload,
  createBlogPostDraft,
  healthCheck,
  publishBlogPost,
} from "../src/payload-cms-client.js";
import { markdownToLexical } from "../src/markdown-to-lexical.js";

vi.mock("../src/payload-cms-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/payload-cms-client.js")>(
      "../src/payload-cms-client.js",
    );
  return {
    ...actual,
    healthCheck: vi.fn(),
    createBlogPostDraft: vi.fn(),
    publishBlogPost: vi.fn(),
  };
});

const healthCheckMock = vi.mocked(healthCheck);
const createBlogPostDraftMock = vi.mocked(createBlogPostDraft);
const publishBlogPostMock = vi.mocked(publishBlogPost);

describe("plugin-payload-cms-agent-tools", () => {
  beforeEach(() => {
    healthCheckMock.mockReset();
    createBlogPostDraftMock.mockReset();
    publishBlogPostMock.mockReset();
  });

  it("registers Payload CMS tools and forwards secret-backed config", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        payloadApiKeySecretRef: "secret-payload",
        payloadApiBaseUrl: "https://cms.astrogen.com.ua/api",
      },
    });
    await plugin.definition.setup(harness.ctx);

    healthCheckMock.mockResolvedValueOnce({
      content: "Payload CMS is reachable",
      data: { buildState: { lastBuildStatus: "queued" } },
    });

    const result = await harness.executeTool(TOOL_NAMES.healthCheck, {});

    expect(healthCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          payloadApiKeySecretRef: "secret-payload",
          payloadApiBaseUrl: "https://cms.astrogen.com.ua/api",
        },
      }),
    );
    expect(result.content).toBe("Payload CMS is reachable");
  });

  it("creates blog post drafts without publishing", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    createBlogPostDraftMock.mockResolvedValueOnce({
      content: "Payload CMS document: id=101",
      data: { id: 101, _status: "draft" },
    });

    await harness.executeTool(TOOL_NAMES.createBlogPostDraft, {
      title: "Натальна карта: що це таке",
      slug: "natalna-karta-shcho-tse-take",
      markdown: "# Натальна карта\n\nТекст статті.",
      category: 1,
    });

    expect(createBlogPostDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Натальна карта: що це таке",
        slug: "natalna-karta-shcho-tse-take",
        markdown: "# Натальна карта\n\nТекст статті.",
      }),
    );
  });

  it("guards the publish tool with explicit confirmation", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    publishBlogPostMock.mockResolvedValueOnce({
      content: "Payload CMS document: id=101, status=published",
      data: { id: 101, _status: "published" },
    });

    await harness.executeTool(TOOL_NAMES.publishBlogPost, {
      id: 101,
      confirmPublish: true,
    });

    expect(publishBlogPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        confirmPublish: true,
      }),
    );
  });
});

describe("Payload CMS content helpers", () => {
  it("converts simple markdown into Payload-compatible Lexical JSON", () => {
    const lexical = markdownToLexical("# Title\n\nIntro paragraph.\n\n- One\n- Two");
    expect(lexical.root.children[0]).toMatchObject({ type: "heading", tag: "h2" });
    expect(lexical.root.children[1]).toMatchObject({ type: "paragraph" });
    expect(lexical.root.children[2]).toMatchObject({ type: "list", tag: "ul" });
  });

  it("builds draft payloads by default", () => {
    const payload = buildBlogPostPayload({
      title: "Article",
      markdown: "Intro",
      coverImage: 49,
      extraFields: { createdBy: 1 },
    });
    expect(payload).toMatchObject({
      title: "Article",
      coverImage: 49,
      createdBy: 1,
      _status: "draft",
    });
    expect(payload.content).toBeTruthy();
  });
});
