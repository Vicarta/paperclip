type LexicalTextNode = {
  mode: "normal";
  text: string;
  type: "text";
  style: "";
  detail: 0;
  format: number;
  version: 1;
};

type LexicalParagraphNode = {
  type: "paragraph";
  format: "";
  indent: 0;
  version: 1;
  children: LexicalTextNode[];
  direction: "ltr";
  textStyle: "";
  textFormat: 0;
};

type LexicalHeadingNode = {
  tag: "h2" | "h3" | "h4";
  type: "heading";
  format: "";
  indent: 0;
  version: 1;
  children: LexicalTextNode[];
  direction: "ltr";
};

type LexicalListItemNode = {
  type: "listitem";
  value: number;
  format: "";
  indent: 0;
  version: 1;
  children: LexicalTextNode[];
  direction: "ltr";
};

type LexicalListNode = {
  tag: "ul" | "ol";
  type: "list";
  start: 1;
  format: "";
  indent: 0;
  version: 1;
  children: LexicalListItemNode[];
  listType: "bullet" | "number";
  direction: "ltr";
};

type LexicalNode = LexicalParagraphNode | LexicalHeadingNode | LexicalListNode;

function stripInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textNode(text: string): LexicalTextNode {
  return {
    mode: "normal",
    text,
    type: "text",
    style: "",
    detail: 0,
    format: 0,
    version: 1,
  };
}

function paragraphNode(text: string): LexicalParagraphNode {
  return {
    type: "paragraph",
    format: "",
    indent: 0,
    version: 1,
    children: [textNode(text)],
    direction: "ltr",
    textStyle: "",
    textFormat: 0,
  };
}

function headingNode(tag: LexicalHeadingNode["tag"], text: string): LexicalHeadingNode {
  return {
    tag,
    type: "heading",
    format: "",
    indent: 0,
    version: 1,
    children: [textNode(text)],
    direction: "ltr",
  };
}

function listItemNode(text: string, value: number): LexicalListItemNode {
  return {
    type: "listitem",
    value,
    format: "",
    indent: 0,
    version: 1,
    children: [textNode(text)],
    direction: "ltr",
  };
}

function listNode(tag: LexicalListNode["tag"], children: LexicalListItemNode[]): LexicalListNode {
  return {
    tag,
    type: "list",
    start: 1,
    format: "",
    indent: 0,
    version: 1,
    children,
    listType: tag === "ol" ? "number" : "bullet",
    direction: "ltr",
  };
}

function flushParagraph(input: { lines: string[]; output: LexicalNode[] }) {
  if (input.lines.length === 0) return;
  const text = stripInlineMarkdown(input.lines.join(" "));
  input.lines.length = 0;
  if (text) input.output.push(paragraphNode(text));
}

function flushList(input: {
  tag: LexicalListNode["tag"] | null;
  items: LexicalListItemNode[];
  output: LexicalNode[];
}) {
  if (!input.tag || input.items.length === 0) return;
  input.output.push(listNode(input.tag, input.items));
  input.tag = null;
  input.items.length = 0;
}

export function markdownToLexical(markdown: string) {
  const output: LexicalNode[] = [];
  const paragraphLines: string[] = [];
  let listTag: LexicalListNode["tag"] | null = null;
  const listItems: LexicalListItemNode[] = [];

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph({ lines: paragraphLines, output });
      flushList({ tag: listTag, items: listItems, output });
      listTag = null;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph({ lines: paragraphLines, output });
      flushList({ tag: listTag, items: listItems, output });
      listTag = null;
      const level = heading[1].length;
      const tag = level <= 2 ? "h2" : level === 3 ? "h3" : "h4";
      output.push(headingNode(tag, stripInlineMarkdown(heading[2])));
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph({ lines: paragraphLines, output });
      if (listTag && listTag !== "ul") {
        flushList({ tag: listTag, items: listItems, output });
      }
      listTag = "ul";
      listItems.push(listItemNode(stripInlineMarkdown(bullet[1]), listItems.length + 1));
      continue;
    }

    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      flushParagraph({ lines: paragraphLines, output });
      if (listTag && listTag !== "ol") {
        flushList({ tag: listTag, items: listItems, output });
      }
      listTag = "ol";
      listItems.push(listItemNode(stripInlineMarkdown(numbered[1]), listItems.length + 1));
      continue;
    }

    flushList({ tag: listTag, items: listItems, output });
    listTag = null;
    paragraphLines.push(line);
  }

  flushParagraph({ lines: paragraphLines, output });
  flushList({ tag: listTag, items: listItems, output });

  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      children: output.length > 0 ? output : [paragraphNode("")],
      direction: "ltr",
    },
  };
}
