import { describe, expect, it } from "vitest";
import { createBlogPostDraft } from "../src/payload-cms-client.js";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Payload CMS draft relation resolution", () => {
  it("resolves configured author and article-type category before one draft create", async () => {
    const requests: Array<{ url: URL; body: unknown }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      requests.push({ url, body });

      if (url.pathname === "/api/categories") {
        return jsonResponse({ docs: [{ id: 10, slug: "astrologiya", title: "Астрологія" }] });
      }
      if (url.pathname === "/api/authors") {
        return jsonResponse({ docs: [{ id: 1, slug: "astrogen", name: "ASTROGEN" }] });
      }
      if (url.pathname === "/api/blogPosts") {
        return jsonResponse({ id: 121, _status: "draft" });
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    const result = await createBlogPostDraft({
      config: {
        payloadApiBaseUrl: "https://cms.astrogen.com.ua/api",
        payloadApiKeySecretRef: "payload-key",
        defaultEditorialAuthor: { name: "Astrogen", slug: "astrogen", roleTitle: "Редакція Astrogen" },
        articleTypeCategoryDefaults: {
          zodiac_profile: { slug: "astrologiya", title: "Астрологія" },
        },
      },
      resolveSecret: async () => "test-secret",
      fetchFn,
      title: "22 травня знак зодіаку",
      slug: "22-travnya-znak-zodiaku",
      articleType: "zodiac_profile",
      articleContent: {
        schemaVersion: "articleContent.v1",
        blocks: [
          { type: "paragraph", text: "Коротке пояснення без фаталістичних висновків." },
          {
            type: "editorialCallout",
            variant: "soft",
            title: "Коротко",
            body: "Дата може бути близькою до межі знаків, тому важливий контекст.",
          },
        ],
      },
      coverImage: 180,
      ogImage: 180,
      relatedPosts: [113, 114, 117],
    });

    const create = requests.find((request) => request.url.pathname === "/api/blogPosts");
    expect(create?.body).toMatchObject({
      author: 1,
      category: 10,
      _status: "draft",
      workflowStatus: "draft",
    });
    expect(create?.body).not.toHaveProperty("articleType");
    expect(result.data).toMatchObject({
      id: 121,
      adminUrl: "https://cms.astrogen.com.ua/admin/collections/blogPosts/121",
    });
  });

  it("fails before a CMS write when a create has no approved category path", async () => {
    let calls = 0;
    await expect(createBlogPostDraft({
      config: {
        payloadApiBaseUrl: "https://cms.astrogen.com.ua/api",
        payloadApiKeySecretRef: "payload-key",
        defaultEditorialAuthor: { name: "Astrogen", slug: "astrogen" },
      },
      resolveSecret: async () => "test-secret",
      fetchFn: async () => {
        calls += 1;
        return jsonResponse({ docs: [] });
      },
      title: "Article",
      slug: "article",
      articleType: "unknown_type",
      articleContent: {
        schemaVersion: "articleContent.v1",
        blocks: [{ type: "paragraph", text: "Text" }],
      },
    })).rejects.toThrow(/category is required/);
    expect(calls).toBe(0);
  });
});
