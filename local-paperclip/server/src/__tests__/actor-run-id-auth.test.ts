import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { actorMiddleware } from "../middleware/auth.js";

function dbWithHeartbeatRuns(rows: Array<{ id: string; agentId: string | null; companyId: string | null }>) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: (value: typeof rows) => unknown) => Promise.resolve(resolve(rows)),
        }),
      }),
    }),
  };
}

async function runMiddleware(runIdHeader: string | undefined, rows: Array<{ id: string; agentId: string | null; companyId: string | null }>) {
  const req = {
    header: (name: string) => {
      if (name.toLowerCase() === "x-paperclip-run-id") return runIdHeader;
      return undefined;
    },
  } as Request;

  await new Promise<void>((resolve, reject) => {
    actorMiddleware(dbWithHeartbeatRuns(rows) as never, { deploymentMode: "local_trusted" })(
      req,
      {} as never,
      (err?: unknown) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });

  return req.actor;
}

describe("actorMiddleware run id header handling", () => {
  it("ignores unknown X-Paperclip-Run-Id values instead of trusting them", async () => {
    const actor = await runMiddleware("not-a-real-run", []);

    expect(actor.type).toBe("board");
    expect(actor.runId).toBeUndefined();
  });

  it("keeps X-Paperclip-Run-Id only when the heartbeat run exists", async () => {
    const actor = await runMiddleware("run-1", [{ id: "run-1", agentId: "agent-1", companyId: "company-1" }]);

    expect(actor.type).toBe("board");
    expect(actor.runId).toBe("run-1");
  });
});
