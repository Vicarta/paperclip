import { constants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type RuntimeEnv = Record<string, string | undefined>;

export type PreparedOpenCodeRuntimeHome = {
  homeDir: string;
  skillsHome: string;
  usedFallback: boolean;
  rejectedHomes: Array<{ homeDir: string; reason: string }>;
};

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function configEnv(config: Record<string, unknown>): Record<string, unknown> {
  return typeof config.env === "object" && config.env !== null && !Array.isArray(config.env)
    ? (config.env as Record<string, unknown>)
    : {};
}

function safeInstanceId(value: string | null): string {
  const normalized = (value ?? "default").replace(/[^A-Za-z0-9._-]/g, "-");
  return normalized || "default";
}

function absoluteHome(value: string): string {
  return path.resolve(value);
}

export function resolvePreferredOpenCodeHome(
  config: Record<string, unknown>,
  env: RuntimeEnv = process.env,
): string {
  const configuredHome = nonEmpty(configEnv(config).HOME);
  const managedHome = nonEmpty(env.PAPERCLIP_OPENCODE_HOME);
  return absoluteHome(configuredHome ?? managedHome ?? os.homedir());
}

export function resolveOpenCodeSkillsHome(
  config: Record<string, unknown>,
  env: RuntimeEnv = process.env,
): string {
  return path.join(resolvePreferredOpenCodeHome(config, env), ".claude", "skills");
}

function fallbackHomes(env: RuntimeEnv): string[] {
  const instanceId = safeInstanceId(nonEmpty(env.PAPERCLIP_INSTANCE_ID));
  const paperclipHome = nonEmpty(env.PAPERCLIP_HOME);
  return [
    ...(paperclipHome
      ? [path.join(absoluteHome(paperclipHome), "instances", instanceId, "runtime", "opencode-home")]
      : []),
    path.join(os.tmpdir(), "paperclip-opencode", instanceId),
  ];
}

function errorReason(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code ? `${code}: ${error.message}` : error.message;
  }
  return String(error);
}

export async function prepareOpenCodeRuntimeHome(
  config: Record<string, unknown>,
  env: RuntimeEnv = process.env,
): Promise<PreparedOpenCodeRuntimeHome> {
  const preferredHome = resolvePreferredOpenCodeHome(config, env);
  const candidates = [...new Set([preferredHome, ...fallbackHomes(env)])];
  const rejectedHomes: PreparedOpenCodeRuntimeHome["rejectedHomes"] = [];

  for (const homeDir of candidates) {
    const skillsHome = path.join(homeDir, ".claude", "skills");
    try {
      await fs.mkdir(skillsHome, { recursive: true });
      await fs.access(skillsHome, constants.R_OK | constants.W_OK);
      return {
        homeDir,
        skillsHome,
        usedFallback: homeDir !== preferredHome,
        rejectedHomes,
      };
    } catch (error) {
      rejectedHomes.push({ homeDir, reason: errorReason(error) });
    }
  }

  const detail = rejectedHomes
    .map((entry) => `${entry.homeDir} (${entry.reason})`)
    .join("; ");
  throw new Error(`No writable OpenCode runtime home is available: ${detail}`);
}
