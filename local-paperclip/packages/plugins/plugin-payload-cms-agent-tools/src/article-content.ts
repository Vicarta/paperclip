export type ArticleContentV1 = {
  schemaVersion: "articleContent.v1";
  blocks: ArticleContentBlock[];
};

export type ArticleContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: "h2" | "h3" | "h4"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "editorialCallout"; variant: "soft" | "brand" | "situation"; title: string; body: string }
  | {
      type: "twoColumnText";
      mode: "text";
      leftTitle: string;
      leftBody: string;
      rightTitle: string;
      rightBody: string;
    }
  | {
      type: "twoColumnText";
      mode: "list";
      leftTitle: string;
      leftBody: string[];
      rightTitle: string;
      rightBody: string[];
    }
  | {
      type: "quietCta";
      title: string;
      text: string;
      linkLabel: string;
      linkUrl: string;
      note?: string;
    };

const HEADING_LEVELS = new Set(["h2", "h3", "h4"]);
const CALLOUT_VARIANTS = new Set(["soft", "brand", "situation"]);
const TWO_COLUMN_MODES = new Set(["text", "list"]);
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function requireString(value: unknown, path: string, opts?: { allowEmpty?: boolean }) {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  const trimmed = value.trim();
  if (!opts?.allowEmpty && trimmed.length === 0) throw new Error(`${path} must not be empty`);
  if (HTML_TAG_PATTERN.test(trimmed)) {
    throw new Error(`${path} must be plain text, not HTML`);
  }
  return trimmed;
}

function requireStringArray(value: unknown, path: string) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array of strings`);
  if (value.length === 0) throw new Error(`${path} must not be empty`);
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function requireBoolean(value: unknown, path: string) {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
}

function validateLinkUrl(value: unknown, path: string) {
  const url = requireString(value, path);
  if (url.startsWith("/")) {
    if (url.startsWith("//")) throw new Error(`${path} must be an internal path or HTTPS URL`);
    return url;
  }
  if (url.startsWith("https://")) return url;
  throw new Error(`${path} must be an internal path or HTTPS URL`);
}

function rejectExtraKeys(record: Record<string, unknown>, allowed: string[], path: string) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) throw new Error(`${path}.${key} is not supported`);
  }
}

function validateBlock(value: unknown, index: number): ArticleContentBlock {
  const path = `articleContent.blocks[${index}]`;
  const block = asRecord(value);
  if (!block) throw new Error(`${path} must be an object`);
  const type = requireString(block.type, `${path}.type`);

  if (type === "paragraph") {
    rejectExtraKeys(block, ["type", "text"], path);
    return { type, text: requireString(block.text, `${path}.text`) };
  }

  if (type === "heading") {
    rejectExtraKeys(block, ["type", "level", "text"], path);
    const level = requireString(block.level, `${path}.level`);
    if (!HEADING_LEVELS.has(level)) throw new Error(`${path}.level must be h2, h3, or h4`);
    return { type, level: level as "h2" | "h3" | "h4", text: requireString(block.text, `${path}.text`) };
  }

  if (type === "list") {
    rejectExtraKeys(block, ["type", "ordered", "items"], path);
    return {
      type,
      ordered: requireBoolean(block.ordered, `${path}.ordered`),
      items: requireStringArray(block.items, `${path}.items`),
    };
  }

  if (type === "editorialCallout") {
    rejectExtraKeys(block, ["type", "variant", "title", "body"], path);
    const variant = requireString(block.variant, `${path}.variant`);
    if (!CALLOUT_VARIANTS.has(variant)) throw new Error(`${path}.variant must be soft, brand, or situation`);
    return {
      type,
      variant: variant as "soft" | "brand" | "situation",
      title: requireString(block.title, `${path}.title`),
      body: requireString(block.body, `${path}.body`),
    };
  }

  if (type === "twoColumnText") {
    rejectExtraKeys(block, ["type", "mode", "leftTitle", "leftBody", "rightTitle", "rightBody"], path);
    const mode = requireString(block.mode, `${path}.mode`);
    if (!TWO_COLUMN_MODES.has(mode)) throw new Error(`${path}.mode must be text or list`);
    const base = {
      type: "twoColumnText" as const,
      leftTitle: requireString(block.leftTitle, `${path}.leftTitle`),
      rightTitle: requireString(block.rightTitle, `${path}.rightTitle`),
    };
    if (mode === "text") {
      return {
        ...base,
        mode: "text",
        leftBody: requireString(block.leftBody, `${path}.leftBody`),
        rightBody: requireString(block.rightBody, `${path}.rightBody`),
      };
    }
    return {
      ...base,
      mode: "list",
      leftBody: requireStringArray(block.leftBody, `${path}.leftBody`),
      rightBody: requireStringArray(block.rightBody, `${path}.rightBody`),
    };
  }

  if (type === "quietCta") {
    rejectExtraKeys(block, ["type", "title", "text", "linkLabel", "linkUrl", "note"], path);
    return {
      type,
      title: requireString(block.title, `${path}.title`),
      text: requireString(block.text, `${path}.text`),
      linkLabel: requireString(block.linkLabel, `${path}.linkLabel`),
      linkUrl: validateLinkUrl(block.linkUrl, `${path}.linkUrl`),
      ...(block.note !== undefined ? { note: requireString(block.note, `${path}.note`) } : {}),
    };
  }

  throw new Error(`${path}.type is not supported`);
}

export function validateArticleContentV1(value: unknown): ArticleContentV1 {
  const content = asRecord(value);
  if (!content) throw new Error("articleContent must be an object");
  rejectExtraKeys(content, ["schemaVersion", "blocks"], "articleContent");
  if (content.schemaVersion !== "articleContent.v1") {
    throw new Error('articleContent.schemaVersion must be "articleContent.v1"');
  }
  if (!Array.isArray(content.blocks)) throw new Error("articleContent.blocks must be an array");
  if (content.blocks.length === 0) throw new Error("articleContent.blocks must not be empty");
  return {
    schemaVersion: "articleContent.v1",
    blocks: content.blocks.map((block, index) => validateBlock(block, index)),
  };
}
