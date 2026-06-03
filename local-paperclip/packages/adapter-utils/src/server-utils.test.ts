import { describe, expect, it } from "vitest";
import { runChildProcess, runningProcesses } from "./server-utils.js";

describe("runChildProcess", () => {
  it("terminates a process that stays alive without producing output", async () => {
    const runId = `idle-timeout-${Date.now()}`;
    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];

    const result = await runChildProcess(runId, process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      cwd: process.cwd(),
      env: {},
      timeoutSec: 0,
      idleTimeoutSec: 1,
      graceSec: 1,
      onLog: async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
    });

    expect(result.timedOut).toBe(true);
    expect(result.timeoutReason).toBe("idle");
    expect(result.stderr).toContain("Process produced no output");
    expect(logs.some((entry) => entry.stream === "stderr" && entry.chunk.includes("Process produced no output"))).toBe(
      true,
    );
    expect(runningProcesses.has(runId)).toBe(false);
  }, 10_000);
});
