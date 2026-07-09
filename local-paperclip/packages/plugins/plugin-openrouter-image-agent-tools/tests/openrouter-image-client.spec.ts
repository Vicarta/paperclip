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
      data: [{ b64_json: "iVBORw0KGgo=" }],
    });

    expect(JSON.stringify(sanitized)).not.toContain("iVBORw0KGgo=");
    expect(JSON.stringify(sanitized)).toContain("<base64 omitted:");
  });

  it("calls OpenRouter images endpoint once per requested candidate with n=1", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.model).toBe("google/gemini-3.1-flash-image");
      expect(body.prompt).toBe("Generate an image.");
      expect(body.aspect_ratio).toBe("16:9");
      expect(body.size).toBe("2K");
      expect(body.output_format).toBe("jpeg");
      expect(body.n).toBe(1);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-123");

      return new Response(JSON.stringify({
        usage: { cost: 0.1675 },
        data: [
          {
            b64_json: "iVBORw0KGgo=",
          },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const result = await generateOpenRouterImage({
      params: {
        prompt: "Generate an image.",
        aspectRatio: "16:9",
        imageSize: "2K",
        outputFormat: "jpg",
        candidateCount: 2,
      },
      config: {
        openrouterApiKeySecretRef: "secret-1",
        defaultModel: "google/gemini-3.1-flash-image",
      },
      resolveSecret: async () => "Bearer token-123",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/images",
      expect.any(Object),
    );
    expect(result.data).toMatchObject({
      model: "google/gemini-3.1-flash-image",
      imageCount: 2,
      providerCostUsd: 0.335,
    });
    expect((result.data as any).images[0]).toMatchObject({
      mimeType: "image/jpeg",
      extension: "jpg",
      dataUrl: "data:image/jpeg;base64,iVBORw0KGgo=",
      bytes: 8,
      source: "openrouter.requests[0].data[0].b64_json",
    });
    expect(JSON.stringify((result.data as any).response)).not.toContain("iVBORw0KGgo=");
  });

  it("normalizes CMS pixel dimensions from size into provider shape fields", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.model).toBe("google/gemini-2.5-flash-image");
      expect(body.aspect_ratio).toBe("16:9");
      expect(body.size).toBeUndefined();
      expect(body.n).toBe(1);
      return new Response(JSON.stringify({
        data: [{ b64_json: "iVBORw0KGgo=" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    await generateOpenRouterImage({
      params: {
        prompt: "Generate an image.",
        size: "1472x822",
        candidateCount: 3,
      },
      config: { openrouterApiKeySecretRef: "secret-1", maxImagesPerRequest: 1 },
      resolveSecret: async () => "token-123",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("throws when OpenRouter returns no image data", async () => {
    await expect(generateOpenRouterImage({
      params: { prompt: "Generate image.", imageSize: "2K" },
      config: { openrouterApiKeySecretRef: "secret-1" },
      resolveSecret: async () => "token-123",
      fetchFn: async () => new Response(JSON.stringify({ data: [], usage: { cost: 0.01 } }), { status: 200 }),
    })).rejects.toThrow("returned no image data");
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
