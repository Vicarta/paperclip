import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import { generateOpenRouterImage } from "../src/openrouter-image-client.js";

vi.mock("../src/openrouter-image-client.js", async () => {
  const actual = await vi.importActual<
    typeof import("../src/openrouter-image-client.js")
  >("../src/openrouter-image-client.js");
  return {
    ...actual,
    generateOpenRouterImage: vi.fn(),
  };
});

const generateOpenRouterImageMock = vi.mocked(generateOpenRouterImage);

describe("plugin-openrouter-image-agent-tools", () => {
  beforeEach(() => {
    generateOpenRouterImageMock.mockReset();
  });

  it("registers the OpenRouter image generation tool", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        openrouterApiKeySecretRef: "secret-openrouter",
      },
    });
    await plugin.definition.setup(harness.ctx);

    generateOpenRouterImageMock.mockResolvedValueOnce({
      content: "OpenRouter image generation completed",
      data: {
        model: "google/gemini-3.1-flash-image",
        providerCostUsd: null,
        imageCount: 1,
        images: [{ index: 0, mimeType: "image/png", extension: "png", dataUrl: "data:image/png;base64,AAAA", bytes: 3 }],
      },
    });

    const result = await harness.executeTool(TOOL_NAMES.generateImage, {
      prompt: "Generate a birthday solar article cover.",
      aspectRatio: "16:9",
      imageSize: "2K",
    });

    expect(generateOpenRouterImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          prompt: "Generate a birthday solar article cover.",
          aspectRatio: "16:9",
          imageSize: "2K",
        },
        config: {
          openrouterApiKeySecretRef: "secret-openrouter",
        },
      }),
    );
    expect(result.content).toBe("OpenRouter image generation completed");
    expect(harness.costs).toHaveLength(0);
  });

  it("writes provider-reported image cost to cost_events", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        openrouterApiKeySecretRef: "secret-openrouter",
        costAccountingMode: "provider_reported",
      },
    });
    await plugin.definition.setup(harness.ctx);

    generateOpenRouterImageMock.mockResolvedValueOnce({
      content: "OpenRouter image generation completed",
      data: {
        model: "google/gemini-3.1-flash-image",
        providerCostUsd: 0.1675,
        imageCount: 1,
        images: [],
      },
    });

    await harness.executeTool(
      TOOL_NAMES.generateImage,
      {
        prompt: "Generate image.",
        model: "google/gemini-3.1-flash-image",
      },
      {
        companyId: "company-openrouter-image",
        projectId: "11111111-1111-1111-1111-111111111111",
        agentId: "22222222-2222-2222-2222-222222222222",
        runId: "33333333-3333-3333-3333-333333333333",
      },
    );

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      companyId: "company-openrouter-image",
      projectId: "11111111-1111-1111-1111-111111111111",
      agentId: "22222222-2222-2222-2222-222222222222",
      heartbeatRunId: "33333333-3333-3333-3333-333333333333",
      provider: "openrouter",
      biller: "openrouter",
      billingType: "metered_api",
      model: "google/gemini-3.1-flash-image",
      billingCode: "openrouter:generate-image",
      costCents: 16,
    });
  });

  it("accumulates estimated sub-cent image costs before writing a cent", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        openrouterApiKeySecretRef: "secret-openrouter",
        costAccountingMode: "estimated_per_image",
        estimatedImageCostUsd: 0.0025,
      },
    });
    await plugin.definition.setup(harness.ctx);

    generateOpenRouterImageMock.mockResolvedValue({
      content: "OpenRouter image generation completed",
      data: {
        model: "google/gemini-3.1-flash-image",
        providerCostUsd: null,
        imageCount: 1,
        images: [],
      },
    });

    for (let index = 0; index < 4; index += 1) {
      await harness.executeTool(
        TOOL_NAMES.generateImage,
        { prompt: `Generate image ${index}.` },
        {
          companyId: "company-openrouter-image",
          projectId: "11111111-1111-1111-1111-111111111111",
          agentId: "22222222-2222-2222-2222-222222222222",
          runId: "33333333-3333-3333-3333-333333333333",
        },
      );
    }

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      provider: "openrouter",
      model: "google/gemini-3.1-flash-image",
      costCents: 1,
    });
  });

  it("does not write cost when provider call fails", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        openrouterApiKeySecretRef: "secret-openrouter",
        costAccountingMode: "estimated_per_image",
        estimatedImageCostUsd: 0.1,
      },
    });
    await plugin.definition.setup(harness.ctx);

    generateOpenRouterImageMock.mockRejectedValueOnce(new Error("provider down"));

    await expect(
      harness.executeTool(TOOL_NAMES.generateImage, { prompt: "Generate image." }),
    ).rejects.toThrow("provider down");
    expect(harness.costs).toHaveLength(0);
  });
});
