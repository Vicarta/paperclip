import { describe, expect, it, vi } from "vitest";
import {
  extractOpenRouterCostUsd,
  generateOpenRouterImage,
  sanitizeProviderResponse,
} from "../src/openrouter-image-client.js";

const tinyPng = "data:image/png;base64,iVBORw0KGgo=";

describe("openrouter-image-client", () => {
  it("extracts OpenRouter cost from common response fields", () => {
    expect(extractOpenRouterCostUsd({ usage: { cost: 0.12 } })).toBe(0.12);
    expect(extractOpenRouterCostUsd({ usage: { total_cost: "0.34" } })).toBe(0.34);
    expect(extractOpenRouterCostUsd({ cost: 0.56 })).toBe(0.56);
    expect(extractOpenRouterCostUsd({ total_cost: "0.78" })).toBe(0.78);
    expect(extractOpenRouterCostUsd({ usage: { cost: 0 } })).toBeNull();
  });

  it("sanitizes base64 image data from provider response bodies", () => {
    const sanitized = sanitizeProviderResponse({
      choices: [{ message: { images: [{ image_url: { url: tinyPng } }] } }],
    });

    expect(JSON.stringify(sanitized)).not.toContain("iVBORw0KGgo=");
    expect(JSON.stringify(sanitized)).toContain("<base64 omitted>");
  });

  it("calls OpenRouter chat completions and returns generated image data", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.model).toBe("google/gemini-3.1-flash-image");
      expect(body.modalities).toEqual(["image", "text"]);
      expect(body.image_config).toEqual({ aspect_ratio: "16:9", image_size: "2K" });
      expect(body.metadata.paperclip_request_type).toBe("image_generation");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-123");

      return new Response(JSON.stringify({
        usage: { cost: 0.1675 },
        choices: [
          {
            message: {
              images: [
                {
                  image_url: { url: tinyPng },
                },
              ],
            },
          },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const result = await generateOpenRouterImage({
      params: {
        prompt: "Generate an image.",
        aspectRatio: "16:9",
        imageSize: "2K",
      },
      config: {
        openrouterApiKeySecretRef: "secret-1",
        defaultModel: "google/gemini-3.1-flash-image",
      },
      resolveSecret: async () => "Bearer token-123",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.any(Object),
    );
    expect(result.data).toMatchObject({
      model: "google/gemini-3.1-flash-image",
      imageCount: 1,
      providerCostUsd: 0.1675,
    });
    expect((result.data as any).images[0]).toMatchObject({
      mimeType: "image/png",
      extension: "png",
      dataUrl: tinyPng,
      bytes: 8,
    });
    expect(JSON.stringify((result.data as any).response)).not.toContain("iVBORw0KGgo=");
  });

  it("throws without returning cost metadata on provider errors", async () => {
    await expect(generateOpenRouterImage({
      params: { prompt: "Generate image." },
      config: { openrouterApiKeySecretRef: "secret-1" },
      resolveSecret: async () => "token-123",
      fetchFn: async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 429 }),
    })).rejects.toThrow("OpenRouter image request failed (429)");
  });
});
