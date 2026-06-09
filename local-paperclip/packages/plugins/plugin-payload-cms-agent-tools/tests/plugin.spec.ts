import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  buildUniqueUploadFilename,
  buildBlogPostPayload,
  cleanupTechnicalBlogPostDraft,
  createBlogPostDraft,
  deleteTaxonomyTerm,
  ensureAuthor,
  ensureTaxonomyTerm,
  healthCheck,
  listBlogPosts,
  publishBlogPost,
  updateTaxonomyTerm,
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
    cleanupTechnicalBlogPostDraft: vi.fn(),
    ensureAuthor: vi.fn(),
    ensureTaxonomyTerm: vi.fn(),
    deleteTaxonomyTerm: vi.fn(),
    updateTaxonomyTerm: vi.fn(),
    listBlogPosts: vi.fn(),
    publishBlogPost: vi.fn(),
  };
});

const healthCheckMock = vi.mocked(healthCheck);
const createBlogPostDraftMock = vi.mocked(createBlogPostDraft);
const cleanupTechnicalBlogPostDraftMock = vi.mocked(cleanupTechnicalBlogPostDraft);
const deleteTaxonomyTermMock = vi.mocked(deleteTaxonomyTerm);
const ensureAuthorMock = vi.mocked(ensureAuthor);
const ensureTaxonomyTermMock = vi.mocked(ensureTaxonomyTerm);
const updateTaxonomyTermMock = vi.mocked(updateTaxonomyTerm);
const listBlogPostsMock = vi.mocked(listBlogPosts);
const publishBlogPostMock = vi.mocked(publishBlogPost);

describe("plugin-payload-cms-agent-tools", () => {
  beforeEach(() => {
    healthCheckMock.mockReset();
    createBlogPostDraftMock.mockReset();
    cleanupTechnicalBlogPostDraftMock.mockReset();
    deleteTaxonomyTermMock.mockReset();
    ensureAuthorMock.mockReset();
    ensureTaxonomyTermMock.mockReset();
    updateTaxonomyTermMock.mockReset();
    listBlogPostsMock.mockReset();
    publishBlogPostMock.mockReset();
  });

  it("generates unique upload filenames to avoid Payload responsive image collisions", () => {
    const first = buildUniqueUploadFilename("/tmp/hero-image-6.png");
    const second = buildUniqueUploadFilename("/tmp/hero-image-6.jpg");

    expect(first).toMatch(/^hero-image-6-[a-z0-9]+-[a-f0-9-]+\.png$/);
    expect(second).toMatch(/^hero-image-6-[a-z0-9]+-[a-f0-9-]+\.jpg$/);
    expect(first).not.toBe(second);
    expect(first.replace(/\.[^.]+$/, "")).not.toBe(second.replace(/\.[^.]+$/, ""));
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
      articleContent: {
        schemaVersion: "articleContent.v1",
        blocks: [
          { type: "heading", level: "h2", text: "Натальна карта" },
          { type: "paragraph", text: "Текст статті." },
        ],
      },
      category: 1,
    });

    expect(createBlogPostDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Натальна карта: що це таке",
        slug: "natalna-karta-shcho-tse-take",
        articleContent: expect.objectContaining({
          schemaVersion: "articleContent.v1",
        }),
      }),
    );
  });

  it("lists blog posts for CMS-backed publishing reports", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    listBlogPostsMock.mockResolvedValueOnce({
      content: "Payload CMS blog posts: 46 matched, 10 returned.",
      data: { totalDocs: 46, docs: [] },
    });

    const result = await harness.executeTool(TOOL_NAMES.listBlogPosts, {
      status: "published",
      publishedFrom: "2026-05-18T00:00:00.000+03:00",
      publishedTo: "2026-05-24T23:59:59.999+03:00",
      limit: 10,
    });

    expect(listBlogPostsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        publishedFrom: "2026-05-18T00:00:00.000+03:00",
        publishedTo: "2026-05-24T23:59:59.999+03:00",
        limit: 10,
      }),
    );
    expect(result.content).toBe("Payload CMS blog posts: 46 matched, 10 returned.");
  });

  it("ensures taxonomy terms for newly approved product routes", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    ensureTaxonomyTermMock.mockResolvedValueOnce({
      content: "Payload CMS categories term created. Payload CMS document: id=7, title=\"Соляр\", slug=solar",
      data: { doc: { id: 7, title: "Соляр", slug: "solar" }, created: true },
    });

    const result = await harness.executeTool(TOOL_NAMES.ensureTaxonomyTerm, {
      collection: "categories",
      title: "Соляр",
      slug: "solar",
    });

    expect(ensureTaxonomyTermMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "categories",
        title: "Соляр",
        slug: "solar",
      }),
    );
    expect(result.content).toContain("Соляр");
  });

  it("deletes orphan taxonomy terms only with explicit confirmation", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    deleteTaxonomyTermMock.mockResolvedValueOnce({
      content: "Deleted Payload CMS categories term: Payload CMS document: id=7, title=\"Експерти\", slug=experts",
      data: { deleted: true, deletedDoc: { id: 7, title: "Експерти", slug: "experts" } },
    });

    const result = await harness.executeTool(TOOL_NAMES.deleteTaxonomyTerm, {
      collection: "categories",
      id: 7,
      expectedSlug: "experts",
      expectedTitle: "Експерти",
      confirmDeleteTaxonomyTerm: true,
    });

    expect(deleteTaxonomyTermMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "categories",
        id: 7,
        expectedSlug: "experts",
        expectedTitle: "Експерти",
        confirmDeleteTaxonomyTerm: true,
      }),
    );
    expect(result.content).toContain("Deleted Payload CMS categories term");
  });

  it("updates taxonomy terms for category SEO metadata and orphan neutralization", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    updateTaxonomyTermMock.mockResolvedValueOnce({
      content: "Updated Payload CMS categories term. Payload CMS document: id=3, title=\"Стосунки\", slug=stosunky",
      data: {
        updated: true,
        after: { id: 3, title: "Стосунки", slug: "stosunky", seoTitle: "Стосунки - Astrogen" },
      },
    });

    const result = await harness.executeTool(TOOL_NAMES.updateTaxonomyTerm, {
      collection: "categories",
      slug: "stosunky",
      expectedSlug: "stosunky",
      expectedTitle: "Стосунки",
      fields: {
        seoTitle: "Стосунки - Astrogen",
        seoDescription: "Матеріали про стосунки в блозі Astrogen.",
        description: "Окремий архів матеріалів про стосунки.",
      },
    });

    expect(updateTaxonomyTermMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "categories",
        slug: "stosunky",
        expectedSlug: "stosunky",
        expectedTitle: "Стосунки",
        fields: expect.objectContaining({
          seoTitle: "Стосунки - Astrogen",
          seoDescription: "Матеріали про стосунки в блозі Astrogen.",
          description: "Окремий архів матеріалів про стосунки.",
        }),
      }),
    );
    expect(result.content).toContain("Updated Payload CMS categories term");
  });

  it("ensures authors for owner-provided expert articles", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    ensureAuthorMock.mockResolvedValueOnce({
      content: "Payload CMS author created. Payload CMS document: id=3, slug=viktoriya-s",
      data: { doc: { id: 3, name: "Вікторія С", slug: "viktoriya-s" }, created: true },
    });

    const result = await harness.executeTool(TOOL_NAMES.ensureAuthor, {
      name: "Вікторія С",
      slug: "viktoriya-s",
      expertUrl: "https://astrogen.com.ua/experts/taro/viktoriya%20-s-1757667515089",
      roleTitle: "Таролог",
    });

    expect(ensureAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Вікторія С",
        slug: "viktoriya-s",
        expertUrl: "https://astrogen.com.ua/experts/taro/viktoriya%20-s-1757667515089",
        roleTitle: "Таролог",
      }),
    );
    expect(result.content).toContain("author created");
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

  it("passes deterministic SEO fields through the publish tool", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    publishBlogPostMock.mockResolvedValueOnce({
      content: "Payload CMS document: id=19, status=published",
      data: { id: 19, _status: "published", noindex: true },
    });

    await harness.executeTool(TOOL_NAMES.publishBlogPost, {
      id: 19,
      confirmPublish: true,
      fields: {
        canonicalUrl: "https://astrogen.com.ua/blog/stosunky/shcho-take-analiz-sumisnosti-pary-v-astrogen/",
        noindex: true,
      },
    });

    expect(publishBlogPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 19,
        confirmPublish: true,
        fields: expect.objectContaining({
          canonicalUrl: "https://astrogen.com.ua/blog/stosunky/shcho-take-analiz-sumisnosti-pary-v-astrogen/",
          noindex: true,
        }),
      }),
    );
  });

  it("cleans up technical blog drafts only through the guarded cleanup tool", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    cleanupTechnicalBlogPostDraftMock.mockResolvedValueOnce({
      content: "Deleted technical Payload CMS blog draft: Payload CMS document: id=46",
      data: { deleted: true },
    });

    await harness.executeTool(TOOL_NAMES.cleanupTechnicalBlogPostDraft, {
      id: 46,
      expectedSlug: "smoke-test-solar-draft-20260530",
      expectedTitle: "Smoke Test Solar Draft",
      confirmTechnicalDraftCleanup: true,
    });

    expect(cleanupTechnicalBlogPostDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 46,
        expectedSlug: "smoke-test-solar-draft-20260530",
        expectedTitle: "Smoke Test Solar Draft",
        confirmTechnicalDraftCleanup: true,
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
      articleContent: {
        schemaVersion: "articleContent.v1",
        blocks: [
          { type: "paragraph", text: "Intro" },
          {
            type: "quietCta",
            title: "Потрібен індивідуальний погляд?",
            text: "Можна перейти до підбору експерта.",
            linkLabel: "Підібрати експерта",
            linkUrl: "/experts",
          },
        ],
      },
      coverImage: 49,
      categorySlug: "solar",
      categoryTitle: "Соляр",
      ensureCategory: true,
      extraFields: { createdBy: 1 },
    });
    expect(payload).toMatchObject({
      title: "Article",
      coverImage: 49,
      createdBy: 1,
      _status: "draft",
      workflowStatus: "draft",
    });
    expect(payload.articleContent).toMatchObject({
      schemaVersion: "articleContent.v1",
      blocks: [
        { type: "paragraph", text: "Intro" },
        { type: "quietCta", linkUrl: "/experts" },
      ],
    });
    expect(payload.content).toBeUndefined();
    expect(payload.categorySlug).toBeUndefined();
    expect(payload.categoryTitle).toBeUndefined();
    expect(payload.ensureCategory).toBeUndefined();
  });

  it("builds publish payloads with SEO fields for published-document updates", () => {
    const payload = buildBlogPostPayload(
      {
        canonicalUrl: "https://astrogen.com.ua/blog/stosunky/shcho-take-analiz-sumisnosti-pary-v-astrogen/",
        noindex: true,
      },
      { publish: true },
    );

    expect(payload).toMatchObject({
      _status: "published",
      canonicalUrl: "https://astrogen.com.ua/blog/stosunky/shcho-take-analiz-sumisnosti-pary-v-astrogen/",
      noindex: true,
    });
    expect(payload.workflowStatus).toBeUndefined();
    expect(payload.publishedAt).toEqual(expect.any(String));
  });

  it("accepts iconList blocks with registered icons only", () => {
    const payload = buildBlogPostPayload({
      title: "Article",
      articleContent: {
        schemaVersion: "articleContent.v1",
        blocks: [
          {
            type: "iconList",
            style: "grid",
            title: "Знаки китайського гороскопу",
            items: [
              { icon: "chinese-rat", label: "Щур", text: "Перший знак китайського циклу." },
              { icon: "chinese-ox", label: "Бик" },
              { icon: "zodiac-aries", label: "Овен" },
              { icon: "editorial-calendar", label: "Дата" },
            ],
          },
        ],
      },
    });

    expect(payload.articleContent).toMatchObject({
      schemaVersion: "articleContent.v1",
      blocks: [
        {
          type: "iconList",
          style: "grid",
          title: "Знаки китайського гороскопу",
          items: [
            { icon: "chinese-rat", label: "Щур", text: "Перший знак китайського циклу." },
            { icon: "chinese-ox", label: "Бик" },
            { icon: "zodiac-aries", label: "Овен" },
            { icon: "editorial-calendar", label: "Дата" },
          ],
        },
      ],
    });
  });

  it("rejects legacy markdown or raw Lexical content for blog text", () => {
    expect(() => buildBlogPostPayload({ title: "Article", markdown: "Intro" } as any)).toThrow(
      /articleContent\.v1/,
    );
    expect(() => buildBlogPostPayload({ title: "Article", content: { root: {} } } as any)).toThrow(
      /articleContent\.v1/,
    );
  });

  it("rejects unsafe articleContent blocks", () => {
    expect(() =>
      buildBlogPostPayload({
        title: "Article",
        articleContent: {
          schemaVersion: "articleContent.v1",
          blocks: [{ type: "paragraph", text: "<strong>HTML тут не буде форматуванням</strong>" }],
        },
      }),
    ).toThrow(/plain text/);

    expect(() =>
      buildBlogPostPayload({
        title: "Article",
        articleContent: {
          schemaVersion: "articleContent.v1",
          blocks: [
            {
              type: "quietCta",
              title: "CTA",
              text: "Text",
              linkLabel: "Open",
              linkUrl: "javascript:alert(1)",
            },
          ],
        },
      }),
    ).toThrow(/internal path or HTTPS URL/);
  });

  it("rejects raw URLs and internal routing notes in visible article text", () => {
    expect(() =>
      buildBlogPostPayload({
        title: "Article",
        articleContent: {
          schemaVersion: "articleContent.v1",
          blocks: [{ type: "paragraph", text: "Читайте далі: https://astrogen.com.ua/free-horoscope" }],
        },
      }),
    ).toThrow(/must not contain raw URLs/);

    expect(() =>
      buildBlogPostPayload({
        title: "Article",
        articleContent: {
          schemaVersion: "articleContent.v1",
          blocks: [
            {
              type: "quietCta",
              title: "Наступний крок",
              text: "Контекстний другий маршрут, якщо він потрібен читачеві.",
              linkLabel: "Відкрити",
              linkUrl: "/money",
            },
          ],
        },
      }),
    ).toThrow(/must not contain internal routing notes/);
  });

  it("rejects unsafe or unregistered iconList icon values", () => {
    const base = {
      schemaVersion: "articleContent.v1",
      blocks: [
        {
          type: "iconList",
          style: "grid",
          title: "Знаки китайського гороскопу",
          items: [{ icon: "chinese-rat", label: "Щур" }],
        },
      ],
    } as const;

    for (const icon of ["🐀", "rat-icon.svg", "chinese-unicorn"]) {
      expect(() =>
        buildBlogPostPayload({
          title: "Article",
          articleContent: {
            ...base,
            blocks: [
              {
                ...base.blocks[0],
                items: [{ icon, label: "Щур" }],
              },
            ],
          },
        }),
      ).toThrow(/allowed icon registry/);
    }

    expect(() =>
      buildBlogPostPayload({
        title: "Article",
        articleContent: {
          ...base,
          blocks: [
            {
              ...base.blocks[0],
              items: [{ icon: "<svg></svg>", label: "Щур" }],
            },
          ],
        },
      }),
    ).toThrow(/plain text/);
  });

  it("rejects iconList blocks with more than 40 items", () => {
    expect(() =>
      buildBlogPostPayload({
        title: "Article",
        articleContent: {
          schemaVersion: "articleContent.v1",
          blocks: [
            {
              type: "iconList",
              style: "compact",
              title: "Too many",
              items: Array.from({ length: 41 }, (_, index) => ({
                icon: "editorial-star",
                label: `Item ${index + 1}`,
              })),
            },
          ],
        },
      }),
    ).toThrow(/at most 40 items/);
  });
});
