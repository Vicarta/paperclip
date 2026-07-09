# Phase 38: Board Auth Password Recovery

## Objective

Restore owner access immediately and add a durable email-based password reset
flow to Paperclip board authentication.

This phase exists because a board user saw `Invalid email or password`, and the
login screen had no self-service recovery path. Manual database resets are not
an acceptable operating model for production.

## Requirements

- The affected owner account can sign in immediately with a temporary password.
- The login screen exposes a clear `Forgot password?` action in sign-in mode.
- Password reset email requests use Better Auth's built-in reset token flow.
- Reset links open a Paperclip UI page where the user can set a new password.
- Reset email transport is instance-level configuration, not an Astrogen
  company plugin dependency.
- If email transport is not configured, the UI must show a clear message rather
  than silently pretending that email was sent.
- Successful password reset revokes old sessions.
- Production deployment must be smoke-tested through the public URL.

## Implementation Plan

1. Immediate access recovery
   - Generate a Better Auth-compatible password hash with the production app
     runtime.
   - Update only the affected credential account.
   - Revoke existing sessions for that user.
   - Verify sign-in through the public reverse-proxy URL.

2. Server reset-email support
   - Add a small auth email helper for Resend-backed password reset emails.
   - Configure Better Auth `emailAndPassword.sendResetPassword` when
     `PAPERCLIP_AUTH_PASSWORD_RESET_RESEND_API_KEY` or `RESEND_API_KEY` and
     `PAPERCLIP_AUTH_PASSWORD_RESET_FROM_EMAIL` are configured.
   - Keep reset tokens short-lived and revoke sessions after reset.
   - Add tests for config detection and reset-email dispatch.

3. UI reset flow
   - Add `Forgot password?` to the sign-in form.
   - Add a request-reset form with user-safe copy: do not reveal whether an
     email exists.
   - Add `/reset-password?token=...` page with password confirmation.
   - Add API wrappers for `/api/auth/request-password-reset` and
     `/api/auth/reset-password`.
   - Add UI tests for the link, request form, and reset page.

4. Production config/deploy
   - Document env vars in `.env.example` and production compose template.
   - Add the env vars to the live compose file using secret material outside
     Git.
   - Build a production image from the patched source.
   - Restart only the app container unless database health requires otherwise.
   - Smoke-test:
     - `/api/health`
     - login with temporary password
     - reset request endpoint
     - reset page route

## Acceptance Criteria

- `o.s@digital-r-evolution.com` can sign in immediately.
- Login page shows `Forgot password?`.
- Reset request can send an email when Resend env is configured.
- Reset token page can set a new password and returns the user to sign in.
- Existing sessions are revoked after reset.
- Tests covering the new server and UI behavior pass.

## Execution Log

- 2026-07-01 Kyiv: reset `o.s@digital-r-evolution.com` password using Better
  Auth's production hashing function, deleted existing sessions, and verified
  public sign-in returns HTTP 200.
- 2026-07-01 Kyiv: implemented Better Auth password reset email support,
  `/reset-password` UI, `Forgot password?` login action, reset API wrappers,
  and targeted server/UI tests.
- 2026-07-01 Kyiv: configured production reset-email transport from the
  existing encrypted Resend secret, using `paperclip@aibizmate.com` as sender.
- 2026-07-01 Kyiv: built and deployed
  `paperclip-app:v2026.626.0-vicarta.13-password-reset-20260701T0811Z`.
  Verified `/api/health`, `/reset-password`, sign-in with the temporary
  password, password-reset request HTTP 200, Better Auth reset token creation,
  and production bundle strings for `Forgot password?` / reset screen.
