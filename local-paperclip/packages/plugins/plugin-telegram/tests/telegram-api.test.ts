import { describe, it, expect, vi } from "vitest";
import { escapeMarkdownV2, sendMessage, splitTelegramText, truncateAtWord } from "../src/telegram-api.js";

describe("escapeMarkdownV2", () => {
  it("escapes underscores", () => {
    expect(escapeMarkdownV2("hello_world")).toBe("hello\\_world");
  });

  it("escapes asterisks", () => {
    expect(escapeMarkdownV2("*bold*")).toBe("\\*bold\\*");
  });

  it("escapes brackets", () => {
    expect(escapeMarkdownV2("[link](url)")).toBe("\\[link\\]\\(url\\)");
  });

  it("escapes backticks", () => {
    expect(escapeMarkdownV2("`code`")).toBe("\\`code\\`");
  });

  it("escapes tildes", () => {
    expect(escapeMarkdownV2("~strikethrough~")).toBe("\\~strikethrough\\~");
  });

  it("escapes hashes", () => {
    expect(escapeMarkdownV2("#heading")).toBe("\\#heading");
  });

  it("escapes plus signs", () => {
    expect(escapeMarkdownV2("a+b")).toBe("a\\+b");
  });

  it("escapes hyphens", () => {
    expect(escapeMarkdownV2("a-b")).toBe("a\\-b");
  });

  it("escapes equal signs", () => {
    expect(escapeMarkdownV2("a=b")).toBe("a\\=b");
  });

  it("escapes pipes", () => {
    expect(escapeMarkdownV2("a|b")).toBe("a\\|b");
  });

  it("escapes curly braces", () => {
    expect(escapeMarkdownV2("{a}")).toBe("\\{a\\}");
  });

  it("escapes dots", () => {
    expect(escapeMarkdownV2("a.b")).toBe("a\\.b");
  });

  it("escapes exclamation marks", () => {
    expect(escapeMarkdownV2("hello!")).toBe("hello\\!");
  });

  it("escapes backslashes", () => {
    expect(escapeMarkdownV2("a\\b")).toBe("a\\\\b");
  });

  it("escapes greater than", () => {
    expect(escapeMarkdownV2("a>b")).toBe("a\\>b");
  });

  it("handles multiple special chars in one string", () => {
    expect(escapeMarkdownV2("PROJ-42: Fix [bug] #1"))
      .toBe("PROJ\\-42: Fix \\[bug\\] \\#1");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeMarkdownV2("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeMarkdownV2("")).toBe("");
  });
});

describe("truncateAtWord", () => {
  it("returns text unchanged if shorter than max", () => {
    expect(truncateAtWord("hello", 10)).toBe("hello");
  });

  it("returns text unchanged if equal to max", () => {
    expect(truncateAtWord("hello", 5)).toBe("hello");
  });

  it("truncates at word boundary and adds ellipsis", () => {
    const result = truncateAtWord("hello world foo bar baz", 15);
    expect(result).toBe("hello world...");
  });

  it("falls back to hard cut when no good word boundary", () => {
    const result = truncateAtWord("abcdefghijklmnopqrstuvwxyz", 10);
    expect(result).toBe("abcdefghij...");
    expect(result.length).toBe(13);
  });

  it("handles single word longer than max", () => {
    const result = truncateAtWord("superlongword", 5);
    expect(result).toBe("super...");
  });

  it("handles text with trailing space at boundary", () => {
    const result = truncateAtWord("aa bb cc dd ee ff", 8);
    expect(result).toBe("aa bb cc...");
  });
});

describe("splitTelegramText", () => {
  it("keeps short messages as one chunk", () => {
    expect(splitTelegramText("hello")).toEqual(["hello"]);
  });

  it("splits long messages without dropping the final content", () => {
    const text = `${Array(900).fill("людський контекст").join(" ")} фінальний висновок`;
    const chunks = splitTelegramText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3900)).toBe(true);
    expect(chunks.join(" ")).toContain("фінальний висновок");
  });
});

describe("sendMessage", () => {
  it("sends long messages as multiple Telegram messages instead of truncating them", async () => {
    const fetch = vi.fn(async (_url: string, init: { body?: string }) => ({
      json: async () => ({
        ok: true,
        result: { message_id: fetch.mock.calls.length },
      }),
      init,
    }));
    const ctx = {
      http: { fetch },
      logger: { warn: vi.fn(), error: vi.fn() },
      metrics: { write: vi.fn() },
    };
    const text = `${Array(900).fill("детальний контекст").join(" ")} фінальний висновок`;

    const messageId = await sendMessage(ctx as never, "token", "chat", text, {
      inlineKeyboard: [[{ text: "Відкрити задачу", url: "https://paperclip.example/AST/issues/AST-1" }]],
    });

    expect(messageId).toBe(1);
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
    const bodies = fetch.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(bodies.at(-1).text).toContain("фінальний висновок");
    expect(bodies[0].reply_markup).toBeUndefined();
    expect(bodies.at(-1).reply_markup).toBeDefined();
  });
});
