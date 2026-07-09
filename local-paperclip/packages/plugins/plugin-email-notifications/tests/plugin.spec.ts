import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";

const runCtx = {
  companyId: "company-email",
  projectId: "11111111-1111-1111-1111-111111111111",
  agentId: "22222222-2222-2222-2222-222222222222",
  runId: "33333333-3333-3333-3333-333333333333",
};

function mockResend(id = "email_123") {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("plugin-email-notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("declares the email notification tools and required capabilities", () => {
    expect(manifest.id).toBe("paperclip.email-notifications");
    expect(manifest.capabilities).toEqual(expect.arrayContaining([
      "agent.tools.register",
      "http.outbound",
      "secrets.read-ref",
      "plugin.state.read",
      "plugin.state.write",
      "costs.write",
    ]));
    expect(manifest.tools?.map((tool) => tool.name)).toEqual([
      TOOL_NAMES.sendEmailNotification,
      TOOL_NAMES.sendChangeReport,
      TOOL_NAMES.sendIncidentReport,
    ]);
  });

  it("sends to configured default recipients and writes delivery proof plus cost", async () => {
    const fetchMock = mockResend("resend-message-1");
    const harness = createTestHarness({
      manifest,
      config: {
        resendApiKeySecretRef: "secret-resend",
        fromEmail: "paperclip@aibizmate.com",
        defaultRecipientEmails: "o.savitsky@gmail.com",
        allowlistedRecipientEmails: "ops@example.com",
        costAccountingMode: "estimated_per_email",
        estimatedEmailCostUsd: 0.001,
      },
    });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool<{
      content: string;
      data: { proof: { providerMessageId: string; recipients: string[] } };
    }>(
      TOOL_NAMES.sendEmailNotification,
      {
        subject: "Astrogen Paperclip test",
        text: "Notification body",
        idempotencyKey: "test-default-recipient",
      },
      runCtx,
    );

    expect(result.content).toBe("Email notification delivered.");
    expect(result.data.proof.providerMessageId).toBe("resend-message-1");
    expect(result.data.proof.recipients).toEqual(["o.savitsky@gmail.com"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer resolved:secret-resend" }),
      }),
    );
    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      companyId: "company-email",
      provider: "resend",
      billingCode: `resend:${TOOL_NAMES.sendEmailNotification}`,
      costCents: 0,
      amountMicros: 1000,
    });
    expect(harness.activity).toHaveLength(1);
  });

  it("rejects explicit recipients outside the allowlist", async () => {
    mockResend();
    const harness = createTestHarness({
      manifest,
      config: {
        resendApiKeySecretRef: "secret-resend",
        fromEmail: "paperclip@aibizmate.com",
        defaultRecipientEmails: "o.savitsky@gmail.com",
        allowlistedRecipientEmails: "o.savitsky@gmail.com",
      },
    });
    await plugin.definition.setup(harness.ctx);

    await expect(harness.executeTool(
      TOOL_NAMES.sendEmailNotification,
      {
        recipientEmails: ["outside@example.com"],
        subject: "Blocked",
        text: "Should not send",
      },
      runCtx,
    )).rejects.toThrow("not allowlisted");
  });

  it("deduplicates non-dry-run delivery by idempotency key", async () => {
    const fetchMock = mockResend("resend-once");
    const harness = createTestHarness({
      manifest,
      config: {
        resendApiKeySecretRef: "secret-resend",
        fromEmail: "paperclip@aibizmate.com",
        defaultRecipientEmails: "o.savitsky@gmail.com",
        allowlistedRecipientEmails: "o.savitsky@gmail.com",
      },
    });
    await plugin.definition.setup(harness.ctx);

    await harness.executeTool(
      TOOL_NAMES.sendEmailNotification,
      {
        subject: "Once",
        text: "Only one provider call",
        idempotencyKey: "same-key",
      },
      runCtx,
    );
    const replay = await harness.executeTool<{ data: { idempotentReplay: boolean } }>(
      TOOL_NAMES.sendEmailNotification,
      {
        subject: "Once",
        text: "Only one provider call",
        idempotencyKey: "same-key",
      },
      runCtx,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(replay.data.idempotentReplay).toBe(true);
  });

  it("validates change report contract and supports dry run without provider call", async () => {
    const fetchMock = mockResend();
    const harness = createTestHarness({
      manifest,
      config: {
        resendApiKeySecretRef: "secret-resend",
        fromEmail: "paperclip@aibizmate.com",
        defaultRecipientEmails: "o.savitsky@gmail.com",
        allowlistedRecipientEmails: "o.savitsky@gmail.com",
      },
    });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool<{
      content: string;
      data: { proof: { dryRun: boolean; subject: string } };
    }>(
      TOOL_NAMES.sendChangeReport,
      {
        summary: "CTO updated Paperclip process contracts.",
        changedItems: ["Added weekly self-learning loop."],
        backupPath: "/home/paperclip/backups/example.dump",
        verification: ["Routine exists and trigger is enabled."],
        dryRun: true,
      },
      runCtx,
    );

    expect(result.content).toBe("Email notification dry run passed.");
    expect(result.data.proof.dryRun).toBe(true);
    expect(result.data.proof.subject).toBe("Astrogen Paperclip: change report");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.costs).toHaveLength(0);
  });
});
