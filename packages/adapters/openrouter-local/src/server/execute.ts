import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { parseObject } from "@paperclipai/adapter-utils/server-utils";
import { execute as openCodeExecute } from "@paperclipai/adapter-opencode-local/server";
import { ensureOpenRouterModelConfiguredAndAvailable } from "./models.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const config = parseObject(ctx.config);
  const runtimeEnv = parseObject(config.env);
  await ensureOpenRouterModelConfiguredAndAvailable({
    model: config.model,
    command: config.command,
    cwd: config.cwd,
    env: runtimeEnv,
  });
  return openCodeExecute(ctx);
}
