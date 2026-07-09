import { describe, expect, it } from "vitest";
import {
  sanitizeIssueDoneComment,
  shouldSuppressAgentErrorNotification,
  shouldSuppressApprovalNotification,
  shouldSuppressGenericIssueDoneNotification,
  shouldSuppressHumanEscalationNotification,
} from "../src/notification-policy.js";

describe("Telegram issue done notification policy", () => {
  it("suppresses generic done notifications for delivery-contract issues", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Payload draft update + Telegram delivery for Chinese horoscope layout package",
      comment: "## Rerun closeout\n\nRetrying delivery proof.",
      hasDeliveryContract: true,
    })).toBe(true);
  });

  it("suppresses internal diagnostic closeouts", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Restore Telegram message-id proof for AST-827 Chinese horoscope delivery",
      comment: "## Result\n\nTelegram proof was not restored. This is a diagnosis/routing lane.",
    })).toBe(true);
  });

  it("keeps real CMS draft-ready notifications", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-38",
      title: "Create blog article draft",
      comment: [
        "Payload CMS draft ready.",
        "Cover image uploaded.",
        "Draft/admin URL: https://cms.astrogen.com.ua/admin/collections/blogPosts/38",
      ].join("\n"),
    })).toBe(false);
  });

  it("suppresses generic Astrogen issue-done notifications by default", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-2201",
      title: "Some future internal article pipeline step with a new title shape",
      comment: "Done.",
    })).toBe(true);
  });

  it("keeps Astrogen final Payload CMS delivery notifications with draft proof", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Stage 64/65/Payload CMS delivery for AST56-1955-03 (experts)",
      comment: [
        "Чернетку статті вже зібрано в CMS з обкладинкою, SEO-метаданими та 3 пов'язаними матеріалами.",
        "CMS admin: https://cms.astrogen.com.ua/admin/collections/blogPosts/83",
        "coverImage / ogImage: media 121.",
      ].join("\n"),
    })).toBe(false);
  });

  it("suppresses deterministic CMS delivery child closeouts even with draft proof", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Deterministic Payload CMS draft delivery for AST56-1575-03 (experts)",
      comment: [
        "Чернетку створено в CMS.",
        "CMS admin URL: https://cms.astrogen.com.ua/admin/collections/blogPosts/72",
        "Cover image uploaded as media 107.",
      ].join("\n"),
    })).toBe(true);
  });

  it("strips markdown noise from human summaries", () => {
    expect(sanitizeIssueDoneComment("## Done\n\n- **Created** [draft](https://example.com) for review."))
      .toBe("Done Created draft for review.");
  });

  it("drops technical markdown comments instead of forwarding raw internals", () => {
    expect(sanitizeIssueDoneComment("## Result\n\nTelegram proof was **not** restored."))
      .toBeNull();
  });

  it("suppresses routed human-escalation response closeouts", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "[Telegram] [Human escalation response] 4",
      comment: "Telegram Response Processed this routed owner reply and wrote it back canonically to AST-926. Matched escalation id...",
    })).toBe(true);
  });

  it("suppresses owner authorization gate closeouts with internal wording", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "HIA owner authorization gate for /solar paid-ads copy scope",
      comment: "HIA Complete Recorded the owner decision canonically on AST-926.",
    })).toBe(true);
  });

  it("suppresses manager closeouts that are not owner-facing notification contracts", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Новий продукт - Соляр",
      comment: [
        "## Manager Closeout",
        "",
        "Accepted upstream review is complete, and the optional downstream paid-ads lane remains intentionally deferred by the owner.",
        "Canonical owner decision: AST-926",
        "Stage 45 paid-ads copy was not started.",
      ].join("\n"),
    })).toBe(true);
  });

  it("suppresses indexing audit parent closeouts with dedup metadata", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Rerun Astrogen GSC indexing audit with micro-batch fallback",
      comment: [
        "## Status",
        "Audit closeout is complete.",
        "Verified dedup metadata now persists on both child follow-up issues.",
        "Both now carry `originKind=seo_technical_finding`.",
      ].join("\n"),
    })).toBe(true);
  });

  it("suppresses disposition-only closeouts that do not tell the owner what to decide", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Delta-check Astrogen internal-linking plan against new CrawlObserver HTML/inlinks session",
      comment: "Paperclip needs a disposition before this issue can continue.",
    })).toBe(true);
  });

  it("suppresses missing-disposition recovery owner closeouts", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Propagate updated Astrogen audience segments into content plan and article cadence",
      comment: "Paperclip could not resolve this issue's missing disposition automatically. The issue is blocked on a recovery owner.",
    })).toBe(true);
  });

  it("suppresses internal CrawlObserver evidence package closeouts without a notification contract", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Fresh CrawlObserver Internal PageRank audit for Astrogen internal linking opportunities",
      comment: [
        "Chief Marketing Officer, нижче свіжа evidence-пакетка по AST-1918 після repaired CrawlObserver.",
        "Джерела і timestamps CrawlObserver: Daily Delta Crawl, 155 pages crawled.",
        "Важливий data gap: спроба взяти analytics_top_pages через allowlisted GSC/GA4 tool.",
      ].join("\n"),
    })).toBe(true);
  });

  it("suppresses manager routing closeouts for internal linking execution lanes", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Rebuild Astrogen internal linking plan from repaired Crawl Observer Internal PageRank",
      comment: [
        "Path type: planned execution AST-1923 is complete and is no longer the live blocker.",
        "Manager routing update: AST-1923 confirmed raw inlink growth is mostly archive/navigation driven.",
      ].join("\n"),
    })).toBe(true);
  });

  it("suppresses intermediate cadence article closeouts", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Brief one approved cadence article: Козеріг знак зодіаку /experts (AST-1946)",
      comment: null,
    })).toBe(true);
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Validate one drafted cadence article: Козеріг знак зодіаку /experts (AST-1946)",
      comment: null,
    })).toBe(true);
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Humanize accepted SEO article: AST56-2088-03 Гороскоп скорпіон /experts",
      comment: null,
    })).toBe(true);
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Payload CMS draft: Гороскоп рак /experts cadence article",
      comment: null,
    })).toBe(true);
  });

  it("suppresses intermediate catch-up article closeouts", () => {
    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Brief catch-up article AST56-1955-04: Повітряні знаки зодіаку /experts",
      comment: null,
    })).toBe(true);

    expect(shouldSuppressGenericIssueDoneNotification({
      title: "Revalidate corrected catch-up article: Знак зодіаку по роках /experts (AST56-1955-01)",
      comment: null,
    })).toBe(true);
  });
});

describe("Telegram agent error notification policy", () => {
  it("suppresses Astrogen runtime setup errors instead of sending raw owner noise", () => {
    expect(shouldSuppressAgentErrorNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-2495",
      issueTitle: "SEO GSC Indexing Auditor",
      errorMessage: "monitor: no codex output for 7m 0s",
    })).toBe(true);

    expect(shouldSuppressAgentErrorNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-1948",
      issueTitle: "Draft one approved cadence article: Козеріг знак зодіаку /experts (AST-1946)",
      errorMessage: "Process adapter missing command",
    })).toBe(true);

    expect(shouldSuppressAgentErrorNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-1948",
      issueTitle: "Draft one approved cadence article: Козеріг знак зодіаку /experts (AST-1946)",
      errorMessage: "OpenRouter adapter requires OPENROUTER_API_KEY.",
    })).toBe(true);

    expect(shouldSuppressAgentErrorNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-1948",
      issueTitle: "Draft one approved cadence article: Козеріг знак зодіаку /experts (AST-1946)",
      errorMessage: "fetch failed",
    })).toBe(true);

    expect(shouldSuppressAgentErrorNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-1969",
      issueTitle: "Draft catch-up article AST56-1955-01: Знак зодіаку по роках /experts",
      errorMessage: "Process lost -- server may have restarted",
    })).toBe(true);

    expect(shouldSuppressAgentErrorNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-2764",
      issueTitle: "Stage 59 draft AST56-1961-03: Терези знак зодіаку жінка /experts",
      errorMessage: "terminated: other side closed",
    })).toBe(true);

    expect(shouldSuppressAgentErrorNotification({
      companyName: "Astrogen",
      issueIdentifier: "AST-2764",
      issueTitle: "Stage 59 draft AST56-1961-03: Терези знак зодіаку жінка /experts",
      errorMessage: "Paperclip issue artifact upload failed (403): Cheap status-only recovery runs cannot update issue documents, plans, or deliverable artifacts",
    })).toBe(true);
  });

  it("keeps non-Astrogen agent errors visible", () => {
    expect(shouldSuppressAgentErrorNotification({
      companyName: "Other",
      issueIdentifier: "OPS-1",
      issueTitle: "Deploy production",
      errorMessage: "Process adapter missing command",
    })).toBe(false);
  });
});

describe("Telegram approval notification policy", () => {
  it("suppresses internal Astrogen runtime approvals", () => {
    expect(shouldSuppressApprovalNotification({
      companyName: "Astrogen",
      approvalType: "request_board_approval",
      title: "AST-2442: CTO/operator: controlled Paperclip reload and AST-2346 projection smoke",
      linkedIssueTexts: [
        "AST-2442 CTO/operator: controlled Paperclip reload and AST-2346 projection smoke in_progress",
        "AST-2457 Implement pinned-run-target invariant and AST-1811 regression coverage in_progress",
      ],
    })).toBe(true);

    expect(shouldSuppressApprovalNotification({
      companyName: "Astrogen",
      approvalType: "request_board_approval",
      title: "AST-2457: Implement pinned-run target invariant and AST-1811 regression coverage",
      linkedIssueTexts: [
        "AST-2457 Implement pinned-run target invariant and AST-1811 regression coverage",
      ],
    })).toBe(true);
  });

  it("keeps Astrogen approvals when the owner must make a business decision", () => {
    expect(shouldSuppressApprovalNotification({
      companyName: "Astrogen",
      approvalType: "request_board_approval",
      title: "Потрібне рішення власника щодо бюджету зовнішніх посилань",
      description: "Owner business decision: approve spend up to 12000 UAH or defer.",
    })).toBe(false);
  });
});

describe("Telegram human escalation notification policy", () => {
  it("suppresses diagnostic escalations that are not owner decisions", () => {
    expect(shouldSuppressHumanEscalationNotification({
      companyName: "Astrogen",
      reason: "explicit_request",
      conversationSummary: [
        "[AST-1436] Потрібне рішення щодо статті.",
        "Technical diagnostic for AST-2458 / AST-2338: validating that the recovered execute route reaches the running Telegram worker with a valid runContext.",
        "This is not the AST-1436 owner decision request.",
      ].join(" "),
      suggestedActions: ["No business decision required from this diagnostic."],
    })).toBe(true);
  });

  it("keeps real owner decision escalations", () => {
    expect(shouldSuppressHumanEscalationNotification({
      companyName: "Astrogen",
      reason: "explicit_request",
      conversationSummary: "Потрібне рішення щодо статті: що робити з темою, якщо запит тягне в бік знака зодіаку або калькулятора?",
      suggestedActions: [
        "1. Залишити поточну тему.",
        "2. Уточнити тему без нового планування.",
      ],
      suggestedReply: "2",
    })).toBe(false);
  });
});
