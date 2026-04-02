import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineEditor } from "./InlineEditor";

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("./MarkdownEditor", () => ({
  MarkdownEditor: React.forwardRef(function MarkdownEditorMock() {
    return null;
  }),
}));

describe("InlineEditor", () => {
  it("renders multiline display mode as markdown instead of flattened plain text", () => {
    const html = renderToStaticMarkup(
      <InlineEditor
        value={"Перший абзац\n\n- пункт один\n- пункт два"}
        onSave={() => {}}
        as="p"
        multiline
      />
    );

    expect(html).toContain("Перший абзац");
    expect(html).toContain("пункт один");
    expect(html).toContain("пункт два");
    expect(html).toContain("<ul>");
  });
});
