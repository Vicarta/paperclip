import { promises as fs } from "node:fs";
import path from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { and, lt, notInArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentWakeupRequests, heartbeatRunEvents, heartbeatRuns } from "@paperclipai/db";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";
import { logger } from "../middleware/logger.js";

const ACTIVE_RUN_STATUSES = ["queued", "running"] as const;
const ACTIVE_WAKEUP_STATUSES = ["queued", "claimed", "running"] as const;

export interface RuntimeRetentionOptions {
  retentionDays?: number;
  runLogRetentionDays?: number;
  runLogCompressAfterHours?: number;
  runLogBasePath?: string;
  now?: Date;
  dryRun?: boolean;
}

export interface RuntimeRetentionResult {
  dryRun: boolean;
  cutoff: Date;
  runLogCutoff: Date;
  heartbeatRunsScrubbed: number;
  heartbeatRunEventsDeleted: number;
  wakeupRequestsDeleted: number;
  runLogFilesDeleted: number;
  runLogBytesDeleted: number;
  runLogFilesCompressed: number;
  runLogBytesCompressed: number;
}

const gzipAsync = promisify(gzip);

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - Math.max(1, Math.trunc(days)) * 24 * 60 * 60 * 1000);
}

function defaultRunLogBasePath() {
  return process.env.RUN_LOG_BASE_PATH ?? path.resolve(resolvePaperclipInstanceRoot(), "data", "run-logs");
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function pruneRunLogFiles(input: {
  basePath: string;
  cutoff: Date;
  dryRun: boolean;
}): Promise<{ count: number; bytes: number }> {
  const files = await walkFiles(input.basePath);
  let count = 0;
  let bytes = 0;
  for (const filePath of files) {
    if (!filePath.endsWith(".ndjson") && !filePath.endsWith(".ndjson.gz")) continue;
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.mtime >= input.cutoff) continue;
    count++;
    bytes += stat.size;
    if (!input.dryRun) {
      await fs.rm(filePath, { force: true });
    }
  }
  return { count, bytes };
}

async function compressRunLogFiles(input: {
  db: Db;
  basePath: string;
  compressCutoff: Date;
  deleteCutoff: Date;
  dryRun: boolean;
}): Promise<{ count: number; bytes: number }> {
  const files = await walkFiles(input.basePath);
  let count = 0;
  let bytes = 0;
  for (const filePath of files) {
    if (!filePath.endsWith(".ndjson")) continue;
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) continue;
    if (stat.mtime >= input.compressCutoff || stat.mtime < input.deleteCutoff) continue;

    count++;
    bytes += stat.size;
    if (input.dryRun) continue;

    const compressedPath = `${filePath}.gz`;
    const source = await fs.readFile(filePath);
    const compressed = await gzipAsync(source);
    await fs.writeFile(compressedPath, compressed);
    await fs.rm(filePath, { force: true });

    const relativeRef = path.relative(input.basePath, filePath);
    const compressedRef = `${relativeRef}.gz`;
    await input.db
      .update(heartbeatRuns)
      .set({
        logRef: compressedRef,
        logBytes: compressed.length,
        logCompressed: true,
        updatedAt: new Date(),
      })
      .where(sql`${heartbeatRuns.logRef} = ${relativeRef}`);
  }
  return { count, bytes };
}

export async function runRuntimeRetention(
  db: Db,
  opts: RuntimeRetentionOptions = {},
): Promise<RuntimeRetentionResult> {
  const now = opts.now ?? new Date();
  const retentionDays = Math.max(1, Math.trunc(opts.retentionDays ?? 5));
  const runLogRetentionDays = Math.max(1, Math.trunc(opts.runLogRetentionDays ?? retentionDays));
  const runLogCompressAfterHours = Math.max(1, Math.trunc(opts.runLogCompressAfterHours ?? 24));
  const cutoff = daysAgo(now, retentionDays);
  const runLogCutoff = daysAgo(now, runLogRetentionDays);
  const runLogCompressCutoff = new Date(now.getTime() - runLogCompressAfterHours * 60 * 60 * 1000);
  const dryRun = opts.dryRun ?? false;

  const oldRunFilter = and(
    lt(heartbeatRuns.createdAt, cutoff),
    notInArray(heartbeatRuns.status, [...ACTIVE_RUN_STATUSES]),
  );

  const [runRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(heartbeatRuns)
    .where(oldRunFilter);

  const [eventRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(heartbeatRunEvents)
    .where(lt(heartbeatRunEvents.createdAt, cutoff));

  const [wakeupRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentWakeupRequests)
    .where(and(
      lt(agentWakeupRequests.createdAt, cutoff),
      notInArray(agentWakeupRequests.status, [...ACTIVE_WAKEUP_STATUSES]),
      sql`not exists (
        select 1
        from heartbeat_runs hr
        where hr.wakeup_request_id = ${agentWakeupRequests.id}
      )`,
    ));

  const runLogBasePath = opts.runLogBasePath ?? defaultRunLogBasePath();
  const runLogCompression = await compressRunLogFiles({
    db,
    basePath: runLogBasePath,
    compressCutoff: runLogCompressCutoff,
    deleteCutoff: runLogCutoff,
    dryRun,
  });
  const runLogPrune = await pruneRunLogFiles({
    basePath: runLogBasePath,
    cutoff: runLogCutoff,
    dryRun,
  });

  const heartbeatRunsScrubbed = Number(runRow?.count ?? 0);
  const heartbeatRunEventsDeleted = Number(eventRow?.count ?? 0);
  const wakeupRequestsDeleted = Number(wakeupRow?.count ?? 0);

  if (!dryRun) {
    const cutoffIso = cutoff.toISOString();
    await db
      .delete(heartbeatRunEvents)
      .where(lt(heartbeatRunEvents.createdAt, cutoff));

    await db
      .update(heartbeatRuns)
      .set({
        usageJson: null,
        resultJson: null,
        stdoutExcerpt: null,
        stderrExcerpt: null,
        contextSnapshot: null,
        logStore: null,
        logRef: null,
        logBytes: null,
        logSha256: null,
        logCompressed: false,
        updatedAt: now,
      })
      .where(oldRunFilter);

    await db.execute(sql`
      delete from agent_wakeup_requests awr
      where awr.created_at < ${cutoffIso}::timestamptz
        and awr.status not in ('queued', 'claimed', 'running')
        and not exists (
          select 1
          from heartbeat_runs hr
          where hr.wakeup_request_id = awr.id
        )
    `);
  }

  return {
    dryRun,
    cutoff,
    runLogCutoff,
    heartbeatRunsScrubbed,
    heartbeatRunEventsDeleted,
    wakeupRequestsDeleted,
    runLogFilesDeleted: runLogPrune.count,
    runLogBytesDeleted: runLogPrune.bytes,
    runLogFilesCompressed: runLogCompression.count,
    runLogBytesCompressed: runLogCompression.bytes,
  };
}

export function startRuntimeRetention(
  db: Db,
  opts: Omit<RuntimeRetentionOptions, "dryRun"> & { intervalMs?: number } = {},
): () => void {
  const intervalMs = Math.max(60_000, Math.trunc(opts.intervalMs ?? 60 * 60 * 1000));
  const run = () => {
    runRuntimeRetention(db, { ...opts, dryRun: false })
      .then((result) => {
        if (
          result.heartbeatRunsScrubbed > 0 ||
          result.heartbeatRunEventsDeleted > 0 ||
          result.wakeupRequestsDeleted > 0 ||
          result.runLogFilesDeleted > 0 ||
          result.runLogFilesCompressed > 0
        ) {
          logger.info(result, "Runtime retention pruned expired debug data");
        }
      })
      .catch((err) => {
        logger.warn({ err }, "Runtime retention sweep failed");
      });
  };

  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  run();
  return () => clearInterval(timer);
}
