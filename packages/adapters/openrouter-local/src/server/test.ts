import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { parseObject } from "@paperclipai/adapter-utils/server-utils";
import { testEnvironment as openCodeTestEnvironment } from "@paperclipai/adapter-opencode-local/server";
import { ensureOpenRouterModelConfiguredAndAvailable } from "./models.js";

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const result = await openCodeTestEnvironment(ctx);
  const config = parseObject(ctx.config);
  const runtimeEnv = parseObject(config.env);

  try {
    await ensureOpenRouterModelConfiguredAndAvailable({
      model: config.model,
      command: config.command,
      cwd: config.cwd,
      env: runtimeEnv,
    });
  } catch (err) {
    result.status = "fail";
    result.checks.push({
      code: "openrouter_model_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Configured OpenRouter model is unavailable.",
      hint: "Choose an openrouter/* model and verify OPENROUTER_API_KEY is configured for this company.",
    });
  }

  return result;
}
