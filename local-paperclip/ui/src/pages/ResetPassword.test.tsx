// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "./ResetPassword";

const resetPasswordMock = vi.hoisted(() => vi.fn());

vi.mock("../api/auth", () => ({
  authApi: {
    resetPassword: (input: unknown) => resetPasswordMock(input),
  },
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: null,
    selectedCompanyId: null,
    companies: [],
    selectionSource: "manual",
    loading: false,
    error: null,
    setSelectedCompanyId: vi.fn(),
    reloadCompanies: vi.fn(),
    createCompany: vi.fn(),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
  flushSync(() => {});
}

describe("ResetPasswordPage", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    resetPasswordMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  async function mount(path = "/reset-password?token=token-123") {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth" element={<div>auth page</div>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
    await flushReact();
    return root;
  }

  it("resets a password using the token from the URL", async () => {
    const root = await mount();
    const inputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    const passwordInput = container.querySelector('input[name="newPassword"]') as HTMLInputElement;
    const confirmInput = container.querySelector('input[name="confirmPassword"]') as HTMLInputElement;

    await act(async () => {
      inputValueSetter!.call(passwordInput, "new-password-123");
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      inputValueSetter!.call(confirmInput, "new-password-123");
      confirmInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushReact();
    await flushReact();

    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: "token-123",
      newPassword: "new-password-123",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Your password has been reset",
    );

    await act(async () => {
      root.unmount();
    });
  });

  it("shows a clear error when the reset token is missing", async () => {
    const root = await mount("/reset-password");

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "missing a token",
    );

    await act(async () => {
      root.unmount();
    });
  });
});
