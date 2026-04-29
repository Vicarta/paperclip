import { describe, expect, it } from "vitest";
import { mergeAdapterConfigs } from "../services/adapter-config-merge.js";

describe("mergeAdapterConfigs", () => {
  it("deep-merges nested env maps instead of replacing them", () => {
    const merged = mergeAdapterConfigs(
      {
        env: {
          OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
          PAPERCLIP_API_URL: "https://paperclip.example",
        },
        timeoutSec: 120,
      },
      {
        env: {
          PAPERCLIP_API_URL: "https://override.example",
        },
      },
    );

    expect(merged).toEqual({
      env: {
        OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
        PAPERCLIP_API_URL: "https://override.example",
      },
      timeoutSec: 120,
    });
  });

  it("allows overlay to unset a top-level key", () => {
    const merged = mergeAdapterConfigs(
      { timeoutSec: 120, env: { OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1" } } },
      { timeoutSec: undefined },
    );

    expect(merged).toEqual({
      env: { OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1" } },
    });
  });
});
