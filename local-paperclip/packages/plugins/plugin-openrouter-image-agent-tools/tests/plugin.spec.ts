import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

const runCtx = {
  companyId: "company-openrouter-image",
  projectId: "11111111-1111-1111-1111-111111111111",
  agentId: "22222222-2222-2222-2222-222222222222",
  runId: "33333333-3333-3333-3333-333333333333",
  issueId: "44444444-4444-4444-4444-444444444444",
};

function humanArtDirection(overrides: Record<string, unknown> = {}) {
  return {
    narrativeMoment: "A reader recognizes that an expert conversation could clarify the next step.",
    sceneArchetype: "discovery_moment",
    setting: "quiet gallery corridor after a consultation",
    subjectArrangement: "one_person",
    actionType: "discovering",
    actionDescription: "The person pauses while reviewing one meaningful result and visibly recognizes a useful pattern.",
    emotion: {
      primary: "recognition",
      intensity: "moderate",
      visibleCues: ["eyes widening slightly", "shoulders releasing"],
    },
    composition: {
      shotDistance: "close_up",
      cameraAngle: "three_quarter",
      gazePlan: "at_meaningful_object",
    },
    dominantProps: ["phone"],
    brandAnchors: ["soft neutral light", "small burgundy accent"],
    avoidVisualPatterns: ["seated person at a desk with laptop and notebook"],
    ...overrides,
  };
}

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
          returnImageData: true,
        },
        config: {
          openrouterApiKeySecretRef: "secret-openrouter",
        },
      }),
    );
    expect(result.content).toBe("OpenRouter image generation completed");
    expect(harness.costs).toHaveLength(0);
  });

  it("requires emotional art direction and blocks similar concepts before a paid call", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        openrouterApiKeySecretRef: "secret-openrouter",
        requireSubjectMode: true,
        structuredArtDirectionMode: "required_for_human_scene",
        visualHistoryLimit: 8,
        minimumDistinctVisualAxes: 4,
        legacyAvoidVisualPatterns: ["repeated laptop, notebook, cup, and neutral seated pose"],
      },
    });
    await plugin.definition.setup(harness.ctx);

    await expect(harness.executeTool(
      TOOL_NAMES.generateImage,
      { prompt: "Generate an editorial cover." },
      runCtx,
    )).rejects.toThrow("subjectMode");
    await expect(harness.executeTool(
      TOOL_NAMES.generateImage,
      { prompt: "Generate an editorial cover.", subjectMode: "human_scene" },
      runCtx,
    )).rejects.toThrow("artDirection is required");
    expect(generateOpenRouterImageMock).not.toHaveBeenCalled();

    generateOpenRouterImageMock.mockResolvedValueOnce({
      content: "OpenRouter image generation completed",
      data: {
        model: "google/gemini-2.5-flash-image",
        providerCostUsd: null,
        imageCount: 1,
        images: [],
      },
    });
    const first = await harness.executeTool(
      TOOL_NAMES.generateImage,
      {
        prompt: "Generate an editorial cover.",
        subjectMode: "human_scene",
        artDirection: humanArtDirection(),
        metadata: { articleKey: "article:first" },
      },
      runCtx,
    );
    expect((first.data as any).governedArtDirectionApplied).toBe(true);
    expect(generateOpenRouterImageMock).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({
        prompt: expect.stringContaining("Primary emotion: recognition"),
      }),
    }));
    expect(generateOpenRouterImageMock.mock.calls[0]?.[0].params.prompt).toContain(
      "repeated laptop, notebook, cup, and neutral seated pose",
    );

    const history = await harness.executeTool(
      TOOL_NAMES.getVisualHistory,
      { limit: 5 },
      runCtx,
    );
    expect((history.data as any).history).toHaveLength(1);
    expect((history.data as any).history[0].articleKey).toBe("article:first");

    await expect(harness.executeTool(
      TOOL_NAMES.generateImage,
      {
        prompt: "Generate another editorial cover.",
        subjectMode: "human_scene",
        artDirection: humanArtDirection(),
        metadata: { articleKey: "article:second" },
      },
      { ...runCtx, issueId: "55555555-5555-5555-5555-555555555555" },
    )).rejects.toThrow("too similar to article:first");
    expect(generateOpenRouterImageMock).toHaveBeenCalledTimes(1);
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
      costCents: 17,
      amountMicros: 167500,
    });
  });

  it("returns generated image result when cost accounting is temporarily unavailable", async () => {
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
    vi.spyOn(harness.ctx.costs, "createEvent").mockRejectedValueOnce(new Error("scope expired"));

    const result = await harness.executeTool(
      TOOL_NAMES.generateImage,
      { prompt: "Generate image." },
      {
        companyId: "company-openrouter-image",
        projectId: "11111111-1111-1111-1111-111111111111",
        agentId: "22222222-2222-2222-2222-222222222222",
        runId: "33333333-3333-3333-3333-333333333333",
      },
    );

    expect(result.content).toContain("OpenRouter image generation completed");
    expect(result.content).toContain("Cost accounting warning");
    expect((result.data as any).costAccountingWarning).toContain("scope expired");
  });

  it("writes generated image data to workspace files and strips dataUrl when requested", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "openrouter-image-plugin-"));
    try {
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
          images: [{
            index: 0,
            mimeType: "image/png",
            extension: "png",
            dataUrl: "data:image/png;base64,iVBORw0KGgo=",
            bytes: 8,
            targetDimensions: { width: 1472, height: 822 },
            actualDimensions: { width: 1408, height: 768 },
            dimensionDeviationPercent: { width: 4.3478260869565215, height: 6.569343065693431 },
            targetDimensionTolerancePercent: 20,
            acceptedWithinTolerance: true,
          }],
        },
      });

      const result = await harness.executeTool(
        TOOL_NAMES.generateImage,
        {
          prompt: "Generate image.",
          outputDir,
          outputFormat: "png",
          returnImageData: false,
          metadata: { issueIdentifier: "AST-106" },
        },
      );

      const data = result.data as any;
      expect(data.images[0].dataUrl).toBeUndefined();
      expect(data.workspaceFiles[0]).toMatchObject({
        index: 0,
        mimeType: "image/png",
        extension: "png",
        bytes: 8,
        targetDimensions: { width: 1472, height: 822 },
        actualDimensions: { width: 1408, height: 768 },
        dimensionDeviationPercent: { width: 4.3478260869565215, height: 6.569343065693431 },
        targetDimensionTolerancePercent: 20,
        acceptedWithinTolerance: true,
      });
      expect(data.workspaceFiles[0].path).toContain("openrouter-ast-106-01.png");
      expect(await readFile(data.workspaceFiles[0].path, "base64")).toBe("iVBORw0KGgo=");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("writes estimated sub-cent image costs with amount micros", async () => {
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

    expect(harness.costs).toHaveLength(4);
    for (const cost of harness.costs) {
      expect(cost).toMatchObject({
        provider: "openrouter",
        model: "google/gemini-3.1-flash-image",
        costCents: 0,
        amountMicros: 2500,
      });
    }
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
