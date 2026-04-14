import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { parseObject } from "@paperclipai/adapter-utils/server-utils";
import { ensureOpenRouterDirectModelConfiguredAndAvailable } from "./models.js";
import { resolveOpenRouterSettings } from "./shared.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = parseObject(ctx.config);
  const settings = resolveOpenRouterSettings(config);
  const checks: AdapterEnvironmentCheck[] = [];

  if (!settings.apiKey) {
    checks.push({
      code: "openrouter_api_key_missing",
      level: "error",
      message: "OpenRouter requires OPENROUTER_API_KEY.",
      hint: "Set OPENROUTER_API_KEY in adapter environment variables, preferably through a company secret reference.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  checks.push({
    code: "openrouter_base_url",
    level: "info",
    message: `Configured API base: ${settings.baseUrl}`,
  });

  try {
    const discovered = await ensureOpenRouterDirectModelConfiguredAndAvailable(config);
    checks.push({
      code: "openrouter_models_loaded",
      level: "info",
      message: `Discovered ${discovered.length} OpenRouter models.`,
    });
  } catch (err) {
    checks.push({
      code: "openrouter_model_validation_failed",
      level: "error",
      message: err instanceof Error ? err.message : "OpenRouter model validation failed.",
      hint: "Verify the API key, base URL, and selected provider/model identifier.",
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
