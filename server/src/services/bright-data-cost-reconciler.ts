import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { pluginConfig, plugins } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { costService } from "./costs.js";
import { pluginStateStore } from "./plugin-state-store.js";
import { secretService } from "./secrets.js";

const BRIGHT_DATA_PLUGIN_KEY = "paperclip.bright-data-agent-tools";
const BRIGHT_DATA_PROVIDER = "brightdata.com";
const BRIGHT_DATA_BILLER = "brightdata.com";
const BRIGHT_DATA_BILLING_TYPE = "metered_api";
const BRIGHT_DATA_STATE_NAMESPACE = "bright-data-cost-reconciler";
const BRIGHT_DATA_DEFAULT_ZONE_PREFIX = "mcp_";

type JsonRecord = Record<string, unknown>;

type BrightDataZoneEntry = {
  name: string;
  type?: string;
  status?: string;
};

type BrightDataBucket = {
  accountKey: string;
  zoneName: string;
  bucketKey: string;
  fromLabel: string;
  toLabel: string;
  fromDate: Date;
  toDate: Date;
  costMilliCents: number;
};

type ZoneCarryState = {
  carryMilliCents: number;
  updatedAt: string;
};

type BucketState = {
  lastSeenMilliCents: number;
  updatedAt: string;
};

export type BrightDataReconcileInput = {
  companyId: string;
  agentId?: string;
  zoneNames?: string[];
  includeAllZones?: boolean;
  includeCurrentDay?: boolean;
  apply?: boolean;
  now?: Date;
};

export type BrightDataReconcileSummary = {
  apply: boolean;
  companyId: string;
  agentId: string | null;
  pluginId: string;
  zonesConsidered: string[];
  eventsCreated: number;
  emittedCostCents: number;
  dryRunEvents: Array<{
    zoneName: string;
    accountKey: string;
    bucketKey: string;
    costCents: number;
    occurredAt: string;
  }>;
  notes: string[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const MONTH_BY_NAME: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseDayLabel(label: string): Date {
  const match = label.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) throw unprocessable(`Unsupported Bright Data date label: ${label}`);
  const [, dayRaw, monthRaw, yearRaw] = match;
  const month = MONTH_BY_NAME[monthRaw];
  if (month == null) throw unprocessable(`Unsupported Bright Data month label: ${label}`);
  return new Date(Date.UTC(Number(yearRaw), month, Number(dayRaw), 0, 0, 0, 0));
}

function usdToMilliCents(value: number): number {
  return Math.max(0, Math.round(value * 1000));
}

function occurredAtForBucket(bucket: BrightDataBucket, now: Date): Date {
  if (bucket.bucketKey === "back_d0") return now;
  return new Date(bucket.toDate.getTime() - 1000);
}

function zoneCarryStateKey(zoneName: string, accountKey: string) {
  return `carry:${accountKey}:${zoneName}`;
}

function bucketStateKey(zoneName: string, accountKey: string, fromLabel: string, toLabel: string) {
  return `bucket:${accountKey}:${zoneName}:${fromLabel}:${toLabel}`;
}

export function normalizeBrightDataZoneCostBuckets(
  zoneName: string,
  payload: unknown,
  options: { includeCurrentDay?: boolean } = {},
): BrightDataBucket[] {
  const root = asRecord(payload);
  if (!root) return [];
  const includeCurrentDay = options.includeCurrentDay === true;
  const buckets: BrightDataBucket[] = [];

  for (const [accountKey, rawAccountPayload] of Object.entries(root)) {
    const accountPayload = asRecord(rawAccountPayload);
    if (!accountPayload) continue;

    for (const [bucketKey, rawBucket] of Object.entries(accountPayload)) {
      if (!/^back_d\d+$/.test(bucketKey)) continue;
      if (!includeCurrentDay && bucketKey === "back_d0") continue;

      const bucket = asRecord(rawBucket);
      if (!bucket) continue;
      const range = asRecord(bucket.range);
      const fromLabel = asNonEmptyString(range?.from);
      const toLabel = asNonEmptyString(range?.to);
      const costUsd = asFiniteNumber(bucket.cost);
      if (!fromLabel || !toLabel || costUsd == null) continue;

      buckets.push({
        accountKey,
        zoneName,
        bucketKey,
        fromLabel,
        toLabel,
        fromDate: parseDayLabel(fromLabel),
        toDate: parseDayLabel(toLabel),
        costMilliCents: usdToMilliCents(costUsd),
      });
    }
  }

  return buckets.sort((left, right) => {
    if (left.fromDate.getTime() !== right.fromDate.getTime()) {
      return left.fromDate.getTime() - right.fromDate.getTime();
    }
    return left.bucketKey.localeCompare(right.bucketKey);
  });
}

async function resolveBrightDataToken(db: Db, companyId: string, pluginId: string) {
  const configRow = await db
    .select({ configJson: pluginConfig.configJson })
    .from(pluginConfig)
    .where(eq(pluginConfig.pluginId, pluginId))
    .then((rows) => rows[0] ?? null);

  if (!configRow) {
    throw notFound(`Plugin config not found for ${BRIGHT_DATA_PLUGIN_KEY}`);
  }

  const configJson = asRecord(configRow.configJson);
  const secretRef = asNonEmptyString(configJson?.brightDataTokenSecretRef);
  if (!secretRef) {
    throw unprocessable(`${BRIGHT_DATA_PLUGIN_KEY} is missing brightDataTokenSecretRef`);
  }

  return await secretService(db).resolveSecretValue(companyId, secretRef, "latest");
}

async function fetchBrightDataJson<T>(
  fetchFn: typeof fetch,
  token: string,
  pathname: string,
  query: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`https://api.brightdata.com${pathname}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Bright Data ${pathname} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

function parseZoneEntries(payload: unknown): BrightDataZoneEntry[] {
  if (!Array.isArray(payload)) return [];
  const entries: BrightDataZoneEntry[] = [];
  for (const entry of payload) {
    const record = asRecord(entry);
    const name = asNonEmptyString(record?.name);
    if (!name) continue;
    entries.push({
      name,
      type: asNonEmptyString(record?.type) ?? undefined,
      status: asNonEmptyString(record?.status) ?? undefined,
    });
  }
  return entries;
}

export async function reconcileBrightDataCosts(
  db: Db,
  input: BrightDataReconcileInput,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<BrightDataReconcileSummary> {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = input.now ?? new Date();
  if (input.apply && !input.agentId) {
    throw unprocessable("agentId is required when apply=true");
  }
  const plugin = await db
    .select({ id: plugins.id, pluginKey: plugins.pluginKey })
    .from(plugins)
    .where(eq(plugins.pluginKey, BRIGHT_DATA_PLUGIN_KEY))
    .then((rows) => rows[0] ?? null);

  if (!plugin) throw notFound(`Plugin not installed: ${BRIGHT_DATA_PLUGIN_KEY}`);

  const token = await resolveBrightDataToken(db, input.companyId, plugin.id);
  const stateStore = pluginStateStore(db);
  const costs = costService(db);

  let zones = input.zoneNames?.filter((value) => value.trim().length > 0) ?? [];
  if (zones.length === 0) {
    const listed = parseZoneEntries(
      await fetchBrightDataJson<unknown>(fetchFn, token, "/zone/get_all_zones"),
    );
    zones = listed
      .map((entry) => entry.name)
      .filter((name) => input.includeAllZones ? true : name.startsWith(BRIGHT_DATA_DEFAULT_ZONE_PREFIX));
  }

  const summary: BrightDataReconcileSummary = {
    apply: input.apply === true,
    companyId: input.companyId,
    agentId: input.agentId ?? null,
    pluginId: plugin.id,
    zonesConsidered: zones,
    eventsCreated: 0,
    emittedCostCents: 0,
    dryRunEvents: [],
    notes: [],
  };

  for (const zoneName of zones) {
    const payload = await fetchBrightDataJson<unknown>(fetchFn, token, "/zone/cost", { zone: zoneName });
    const buckets = normalizeBrightDataZoneCostBuckets(zoneName, payload, {
      includeCurrentDay: input.includeCurrentDay,
    });

    if (buckets.length === 0) {
      summary.notes.push(`No eligible daily buckets found for zone ${zoneName}`);
      continue;
    }

    const bucketsByAccount = new Map<string, BrightDataBucket[]>();
    for (const bucket of buckets) {
      const list = bucketsByAccount.get(bucket.accountKey) ?? [];
      list.push(bucket);
      bucketsByAccount.set(bucket.accountKey, list);
    }

    for (const [accountKey, accountBuckets] of bucketsByAccount.entries()) {
      const carryKey = zoneCarryStateKey(zoneName, accountKey);
      const carryState = await stateStore.get(plugin.id, "company", carryKey, {
        scopeId: input.companyId,
        namespace: BRIGHT_DATA_STATE_NAMESPACE,
      }) as ZoneCarryState | null;

      let carryMilliCents = Math.max(0, Number(carryState?.carryMilliCents ?? 0));

      for (const bucket of accountBuckets) {
        const stateKey = bucketStateKey(zoneName, accountKey, bucket.fromLabel, bucket.toLabel);
        const storedBucketState = await stateStore.get(plugin.id, "company", stateKey, {
          scopeId: input.companyId,
          namespace: BRIGHT_DATA_STATE_NAMESPACE,
        }) as BucketState | null;

        const previousSeenMilliCents = Math.max(0, Number(storedBucketState?.lastSeenMilliCents ?? 0));
        const deltaMilliCents = bucket.costMilliCents - previousSeenMilliCents;

        if (deltaMilliCents < 0) {
          summary.notes.push(
            `Bright Data bucket ${zoneName}/${accountKey}/${bucket.bucketKey} decreased from ${previousSeenMilliCents} to ${bucket.costMilliCents} milli-cents; resetting bucket baseline without negative cost event.`,
          );
          carryMilliCents = 0;
          if (input.apply) {
            await stateStore.set(plugin.id, {
              scopeKind: "company",
              scopeId: input.companyId,
              namespace: BRIGHT_DATA_STATE_NAMESPACE,
              stateKey,
              value: {
                lastSeenMilliCents: bucket.costMilliCents,
                updatedAt: now.toISOString(),
              } satisfies BucketState,
            });
          }
          continue;
        }

        const availableMilliCents = carryMilliCents + deltaMilliCents;
        const emitCostCents = Math.floor(availableMilliCents / 10);
        carryMilliCents = availableMilliCents % 10;

        if (emitCostCents > 0) {
          const occurredAt = occurredAtForBucket(bucket, now);
          if (input.apply) {
            await costs.createEvent(input.companyId, {
              agentId: input.agentId!,
              issueId: null,
              projectId: null,
              goalId: null,
              heartbeatRunId: null,
              billingCode: `bright-data-zone-cost:${zoneName}:${bucket.bucketKey}`,
              provider: BRIGHT_DATA_PROVIDER,
              biller: BRIGHT_DATA_BILLER,
              billingType: BRIGHT_DATA_BILLING_TYPE,
              model: `zone:${zoneName}:daily_aggregate`,
              inputTokens: 0,
              cachedInputTokens: 0,
              outputTokens: 0,
              costCents: emitCostCents,
              occurredAt,
            });
            summary.eventsCreated += 1;
            summary.emittedCostCents += emitCostCents;
          } else {
            summary.dryRunEvents.push({
              zoneName,
              accountKey,
              bucketKey: bucket.bucketKey,
              costCents: emitCostCents,
              occurredAt: occurredAt.toISOString(),
            });
          }
        }

        if (input.apply) {
          await stateStore.set(plugin.id, {
            scopeKind: "company",
            scopeId: input.companyId,
            namespace: BRIGHT_DATA_STATE_NAMESPACE,
            stateKey,
            value: {
              lastSeenMilliCents: bucket.costMilliCents,
              updatedAt: now.toISOString(),
            } satisfies BucketState,
          });
        }
      }

      if (input.apply) {
        await stateStore.set(plugin.id, {
          scopeKind: "company",
          scopeId: input.companyId,
          namespace: BRIGHT_DATA_STATE_NAMESPACE,
          stateKey: carryKey,
          value: {
            carryMilliCents,
            updatedAt: now.toISOString(),
          } satisfies ZoneCarryState,
        });
      }
    }
  }

  return summary;
}
