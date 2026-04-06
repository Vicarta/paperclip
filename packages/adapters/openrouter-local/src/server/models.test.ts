import { describe, expect, it, vi } from "vitest";
import * as openCodeServer from "@paperclipai/adapter-opencode-local/server";
import { ensureOpenRouterModelConfiguredAndAvailable, listOpenRouterModels } from "./models.js";

describe("openrouter models", () => {
  it("filters non-openrouter models from discovery", async () => {
    vi.spyOn(openCodeServer, "listOpenCodeModels").mockResolvedValue([
      { id: "openrouter/openai/gpt-5", label: "openrouter/openai/gpt-5" },
      { id: "anthropic/claude-sonnet-4-5", label: "anthropic/claude-sonnet-4-5" },
    ]);

    await expect(listOpenRouterModels()).resolves.toEqual([
      { id: "openrouter/openai/gpt-5", label: "openrouter/openai/gpt-5" },
    ]);
  });

  it("passes discovery config through to OpenCode model listing", async () => {
    const spy = vi.spyOn(openCodeServer, "listOpenCodeModels").mockResolvedValue([]);

    await listOpenRouterModels({
      command: "opencode",
      cwd: "/tmp/paperclip",
      env: { OPENROUTER_API_KEY: "secret" },
    });

    expect(spy).toHaveBeenCalledWith({
      command: "opencode",
      cwd: "/tmp/paperclip",
      env: { OPENROUTER_API_KEY: "secret" },
    });
  });

  it("rejects configured models outside openrouter namespace", async () => {
    await expect(
      ensureOpenRouterModelConfiguredAndAvailable({ model: "anthropic/claude-sonnet-4-5" }),
    ).rejects.toThrow(/must start with openrouter/i);
  });
});
