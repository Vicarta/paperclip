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

  it("rejects configured models outside openrouter namespace", async () => {
    await expect(
      ensureOpenRouterModelConfiguredAndAvailable({ model: "anthropic/claude-sonnet-4-5" }),
    ).rejects.toThrow(/must start with openrouter/i);
  });
});
