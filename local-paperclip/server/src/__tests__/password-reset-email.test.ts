import { describe, expect, it, vi } from "vitest";
import {
  buildPasswordResetEmail,
  resolvePasswordResetEmailConfig,
  sendPasswordResetEmail,
} from "../auth/password-reset-email.js";

describe("password reset email", () => {
  it("requires both a Resend API key and a from email", () => {
    expect(resolvePasswordResetEmailConfig({})).toBeNull();
    expect(resolvePasswordResetEmailConfig({
      PAPERCLIP_AUTH_PASSWORD_RESET_RESEND_API_KEY: "re_123",
    })).toBeNull();
    expect(resolvePasswordResetEmailConfig({
      PAPERCLIP_AUTH_PASSWORD_RESET_FROM_EMAIL: "paperclip@example.com",
    })).toBeNull();
  });

  it("builds config from Paperclip-specific env vars", () => {
    expect(resolvePasswordResetEmailConfig({
      PAPERCLIP_AUTH_PASSWORD_RESET_RESEND_API_KEY: "re_123",
      PAPERCLIP_AUTH_PASSWORD_RESET_FROM_EMAIL: "Paperclip <paperclip@example.com>",
      PAPERCLIP_AUTH_PASSWORD_RESET_REPLY_TO: "support@example.com",
      PAPERCLIP_AUTH_PASSWORD_RESET_SUBJECT: "Choose a new password",
    })).toEqual({
      provider: "resend",
      apiKey: "re_123",
      fromEmail: "Paperclip <paperclip@example.com>",
      replyTo: "support@example.com",
      subject: "Choose a new password",
    });
  });

  it("includes the reset URL in text and HTML bodies", () => {
    const email = buildPasswordResetEmail({
      name: "Oleh",
      resetUrl: "https://paperclip.example/reset-password?token=abc",
    });

    expect(email.text).toContain("Hi Oleh,");
    expect(email.text).toContain("https://paperclip.example/reset-password?token=abc");
    expect(email.html).toContain("https://paperclip.example/reset-password?token=abc");
  });

  it("sends password reset email through Resend", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    await sendPasswordResetEmail({
      user: { email: "owner@example.com", name: "Owner" },
      url: "https://paperclip.example/reset-password?token=abc",
      config: {
        provider: "resend",
        apiKey: "re_123",
        fromEmail: "Paperclip <paperclip@example.com>",
        replyTo: "support@example.com",
        subject: "Reset your Paperclip password",
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_123",
        }),
      }),
    );
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toMatchObject({
      from: "Paperclip <paperclip@example.com>",
      to: ["owner@example.com"],
      reply_to: "support@example.com",
      subject: "Reset your Paperclip password",
    });
    expect(body.text).toContain("https://paperclip.example/reset-password?token=abc");
  });
});
