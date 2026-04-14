import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import { searchSerper } from "../src/serper-client.js";

vi.mock("../src/serper-client.js", async () => {
  const actual = await vi.importActual<typeof import("../src/serper-client.js")>(
    "../src/serper-client.js",
  );
  return {
    ...actual,
    searchSerper: vi.fn(),
  };
});

const searchSerperMock = vi.mocked(searchSerper);

describe("plugin-serper-agent-tools", () => {
  beforeEach(() => {
    searchSerperMock.mockReset();
  });

  it("registers the Serper-backed search tool", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        serperApiKeySecretRef: "secret-1",
      },
    });
    await plugin.definition.setup(harness.ctx);

    searchSerperMock.mockResolvedValueOnce({
      content: "Serper web search results",
      data: { organic: [{ title: "Example" }] },
    });

    const result = await harness.executeTool(TOOL_NAMES.googleSearch, {
      q: "astrogen фінансова натальна карта",
    });

    expect(searchSerperMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { q: "astrogen фінансова натальна карта" },
        config: { serperApiKeySecretRef: "secret-1" },
      }),
    );
    expect(result.content).toBe("Serper web search results");
  });
});
