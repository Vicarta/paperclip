import { describe, expect, it } from "vitest";
import {
  sanitizeIssueDoneComment,
  shouldSuppressGenericIssueDoneNotification,
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
      title: "Create blog article draft",
      comment: [
        "Payload CMS draft ready.",
        "Cover image uploaded.",
        "Draft/admin URL: https://cms.astrogen.com.ua/admin/collections/blogPosts/38",
      ].join("\n"),
    })).toBe(false);
  });

  it("strips markdown noise from human summaries", () => {
    expect(sanitizeIssueDoneComment("## Done\n\n- **Created** [draft](https://example.com) for review."))
      .toBe("Done Created draft for review.");
  });

  it("drops technical markdown comments instead of forwarding raw internals", () => {
    expect(sanitizeIssueDoneComment("## Result\n\nTelegram proof was **not** restored."))
      .toBeNull();
  });
});
