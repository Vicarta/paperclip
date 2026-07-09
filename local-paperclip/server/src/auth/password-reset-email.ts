type PasswordResetEmailEnv = Partial<Record<
  | "PAPERCLIP_AUTH_PASSWORD_RESET_RESEND_API_KEY"
  | "PAPERCLIP_AUTH_PASSWORD_RESET_FROM_EMAIL"
  | "PAPERCLIP_AUTH_PASSWORD_RESET_REPLY_TO"
  | "PAPERCLIP_AUTH_PASSWORD_RESET_SUBJECT"
  | "RESEND_API_KEY",
  string
>>;

export type PasswordResetEmailConfig = {
  provider: "resend";
  apiKey: string;
  fromEmail: string;
  replyTo?: string;
  subject: string;
};

export type PasswordResetEmailInput = {
  user: {
    email?: string | null;
    name?: string | null;
  };
  url: string;
  config: PasswordResetEmailConfig;
  fetchFn?: typeof fetch;
};

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolvePasswordResetEmailConfig(
  env: PasswordResetEmailEnv = process.env,
): PasswordResetEmailConfig | null {
  const apiKey = nonEmpty(env.PAPERCLIP_AUTH_PASSWORD_RESET_RESEND_API_KEY) ?? nonEmpty(env.RESEND_API_KEY);
  const fromEmail = nonEmpty(env.PAPERCLIP_AUTH_PASSWORD_RESET_FROM_EMAIL);
  if (!apiKey || !fromEmail) return null;

  return {
    provider: "resend",
    apiKey,
    fromEmail,
    replyTo: nonEmpty(env.PAPERCLIP_AUTH_PASSWORD_RESET_REPLY_TO),
    subject: nonEmpty(env.PAPERCLIP_AUTH_PASSWORD_RESET_SUBJECT) ?? "Reset your Paperclip password",
  };
}

export function buildPasswordResetEmail(input: {
  name?: string | null;
  resetUrl: string;
}) {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const text = [
    greeting,
    "",
    "We received a request to reset the password for your Paperclip account.",
    "Use this link to choose a new password:",
    input.resetUrl,
    "",
    "This link expires soon. If you did not request this reset, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111827;">
      <p>${escapeHtml(greeting)}</p>
      <p>We received a request to reset the password for your Paperclip account.</p>
      <p>
        <a href="${escapeHtml(input.resetUrl)}" style="display: inline-block; padding: 10px 14px; border-radius: 6px; background: #111827; color: #ffffff; text-decoration: none;">
          Reset password
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">This link expires soon. If you did not request this reset, you can ignore this email.</p>
    </div>
  `.trim();

  return { text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const to = nonEmpty(input.user.email ?? undefined);
  if (!to) throw new Error("Cannot send password reset email because the user has no email address");

  const { text, html } = buildPasswordResetEmail({
    name: input.user.name,
    resetUrl: input.url,
  });

  const response = await (input.fetchFn ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: input.config.fromEmail,
      to: [to],
      subject: input.config.subject,
      text,
      html,
      ...(input.config.replyTo ? { reply_to: input.config.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend password reset email failed (${response.status}): ${detail}`);
  }
}
