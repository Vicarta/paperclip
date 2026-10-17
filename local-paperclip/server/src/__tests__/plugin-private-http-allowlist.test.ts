import { describe, expect, it } from "vitest";
import {
  resolvePluginFetchTimeoutMs,
  resolvePluginPrivateHttpAllowSet,
} from "../services/plugin-host-services.js";

describe("plugin private HTTP allowlist", () => {
  it("accepts exact lower-cased host and port authorities", () => {
    expect([
      ...resolvePluginPrivateHttpAllowSet("100.98.5.50:8000, MCP.INTERNAL:8443"),
    ]).toEqual(["100.98.5.50:8000", "mcp.internal:8443"]);
  });

  it("does not accept CIDRs, URLs, paths, or portless hosts", () => {
    for (const value of [
      "100.64.0.0/10",
      "http://100.98.5.50:8000",
      "100.98.5.50:8000/mcp",
      "mcp.internal",
    ]) {
      expect(() => resolvePluginPrivateHttpAllowSet(value)).toThrow(
        /Invalid PAPERCLIP_PLUGIN_PRIVATE_HTTP_ALLOWLIST/,
      );
    }
  });

  it("returns an empty set when no authorities are configured", () => {
    expect(resolvePluginPrivateHttpAllowSet("").size).toBe(0);
  });
});

describe("plugin HTTP timeout bounds", () => {
  it("keeps the secure default and clamps explicit invocation bounds", () => {
    expect(resolvePluginFetchTimeoutMs(undefined)).toBe(30_000);
    expect(resolvePluginFetchTimeoutMs(180_000)).toBe(180_000);
    expect(resolvePluginFetchTimeoutMs(10)).toBe(1_000);
    expect(resolvePluginFetchTimeoutMs(20 * 60 * 1_000)).toBe(15 * 60 * 1_000);
  });
});
