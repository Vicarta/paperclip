export const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

export const iconListIcons = [
  "chinese-rat",
  "chinese-ox",
  "chinese-tiger",
  "chinese-rabbit",
  "chinese-dragon",
  "chinese-snake",
  "chinese-horse",
  "chinese-goat",
  "chinese-monkey",
  "chinese-rooster",
  "chinese-dog",
  "chinese-pig",
  "zodiac-aries",
  "zodiac-taurus",
  "zodiac-gemini",
  "zodiac-cancer",
  "zodiac-leo",
  "zodiac-virgo",
  "zodiac-libra",
  "zodiac-scorpio",
  "zodiac-sagittarius",
  "zodiac-capricorn",
  "zodiac-aquarius",
  "zodiac-pisces",
  "editorial-check",
  "editorial-info",
  "editorial-calendar",
  "editorial-money",
  "editorial-heart",
  "editorial-star",
  "editorial-people",
  "editorial-chat",
  "editorial-target",
  "editorial-book",
] as const;

export const textSpanSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
    linkUrl: { type: "string" },
  },
  required: ["text"],
  additionalProperties: false,
} as const;

export const textSpansSchema = {
  type: "array",
  minItems: 1,
  items: textSpanSchema,
} as const;

export const articleContentSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: ["articleContent.v1"] },
    blocks: {
      type: "array",
      minItems: 1,
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["paragraph"] },
              text: { type: "string" },
              spans: textSpansSchema,
            },
            required: ["type", "text"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["heading"] },
              level: { type: "string", enum: ["h2", "h3", "h4"] },
              text: { type: "string" },
            },
            required: ["type", "level", "text"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["list"] },
              ordered: { type: "boolean" },
              items: { type: "array", minItems: 1, items: { type: "string" } },
            },
            required: ["type", "ordered", "items"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["editorialCallout"] },
              variant: { type: "string", enum: ["soft", "brand", "situation"] },
              title: { type: "string" },
              body: { type: "string" },
              bodySpans: textSpansSchema,
            },
            required: ["type", "variant", "title", "body"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["iconList"] },
              style: { type: "string", enum: ["grid", "compact", "twoColumn"] },
              title: { type: "string" },
              items: {
                type: "array",
                minItems: 1,
                maxItems: 40,
                items: {
                  type: "object",
                  properties: {
                    icon: { type: "string", enum: iconListIcons },
                    label: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["icon", "label"],
                  additionalProperties: false,
                },
              },
            },
            required: ["type", "style", "title", "items"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["twoColumnText"] },
              mode: { type: "string", enum: ["text"] },
              leftTitle: { type: "string" },
              leftBody: { type: "string" },
              leftBodySpans: textSpansSchema,
              rightTitle: { type: "string" },
              rightBody: { type: "string" },
              rightBodySpans: textSpansSchema,
            },
            required: ["type", "mode", "leftTitle", "leftBody", "rightTitle", "rightBody"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["twoColumnText"] },
              mode: { type: "string", enum: ["list"] },
              leftTitle: { type: "string" },
              leftBody: { type: "array", minItems: 1, items: { type: "string" } },
              rightTitle: { type: "string" },
              rightBody: { type: "array", minItems: 1, items: { type: "string" } },
            },
            required: ["type", "mode", "leftTitle", "leftBody", "rightTitle", "rightBody"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["quietCta"] },
              title: { type: "string" },
              text: { type: "string" },
              linkLabel: { type: "string" },
              linkUrl: { type: "string" },
              note: { type: "string" },
            },
            required: ["type", "title", "text", "linkLabel", "linkUrl"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["schemaVersion", "blocks"],
  additionalProperties: false,
} as const;

export const blogPostFieldsSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    excerpt: { type: "string" },
    articleContent: articleContentSchema,
    coverImage: { type: ["number", "string"] },
    ogImage: { type: ["number", "string"] },
    author: { type: ["number", "string"] },
    category: { type: ["number", "string"] },
    categorySlug: { type: "string" },
    categoryTitle: { type: "string" },
    ensureCategory: { type: "boolean" },
    tags: {
      type: "array",
      items: { type: ["number", "string"] },
    },
    relatedPosts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: ["number", "string"] },
    },
    workflowStatus: { type: "string" },
    publishedAt: { type: "string" },
    scheduledPublishAt: { type: "string" },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    canonicalUrl: { type: "string" },
    noindex: { type: "boolean" },
    extraFields: looseObjectSchema,
  },
  additionalProperties: false,
} as const;

export const updateBlogPostDraftParametersSchema = {
  type: "object",
  properties: {
    id: { type: ["number", "string"] },
    slug: { type: "string" },
    fields: blogPostFieldsSchema,
  },
  required: ["fields"],
  additionalProperties: false,
} as const;
