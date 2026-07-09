import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles } from "lucide-react";
import { authApi } from "../api/auth";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const errorId = "reset-password-error";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("This reset link is missing a token. Request a new password reset link.");
      if (password.length < 8) throw new Error("Use at least 8 characters for the new password.");
      if (password !== confirmPassword) throw new Error("The passwords do not match.");
      await authApi.resetPassword({ token, newPassword: password });
    },
    onSuccess: () => {
      setError(null);
      setDone(true);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Password reset failed");
    },
  });

  const canSubmit = token.length > 0 && password.length >= 8 && confirmPassword.length >= 8;

  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-full flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Paperclip</span>
          </div>

          <h1 className="text-xl font-semibold">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a new password for your Paperclip account.
          </p>

          {done ? (
            <div className="mt-6 space-y-4">
              <p role="status" className="text-sm text-muted-foreground">
                Your password has been reset. Sign in with the new password.
              </p>
              <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form
              className="mt-6 space-y-4"
              method="post"
              action="/api/auth/reset-password"
              onSubmit={(event) => {
                event.preventDefault();
                if (mutation.isPending) return;
                mutation.mutate();
              }}
            >
              {!token && (
                <p id={errorId} role="alert" className="text-xs text-destructive">
                  This reset link is missing a token. Request a new password reset link.
                </p>
              )}
              <div>
                <label htmlFor="new-password" className="text-xs text-muted-foreground mb-1 block">
                  New password
                </label>
                <input
                  id="new-password"
                  name="newPassword"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="text-xs text-muted-foreground mb-1 block">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
              {error && (
                <p id={errorId} role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={mutation.isPending}
                aria-disabled={!canSubmit || mutation.isPending}
                className={`w-full ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
              >
                {mutation.isPending ? "Working..." : "Reset password"}
              </Button>
              <div className="text-sm text-muted-foreground">
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-2"
                  onClick={() => navigate("/auth", { replace: true })}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
