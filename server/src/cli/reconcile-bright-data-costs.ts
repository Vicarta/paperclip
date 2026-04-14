import { createDb } from "@paperclipai/db";
import { reconcileBrightDataCosts } from "../services/bright-data-cost-reconciler.js";

type Options = {
  companyId: string | null;
  agentId: string | null;
  zones: string[];
  apply: boolean;
  includeCurrentDay: boolean;
  includeAllZones: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    companyId: null,
    agentId: null,
    zones: [],
    apply: false,
    includeCurrentDay: false,
    includeAllZones: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--company-id") {
      options.companyId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--agent-id") {
      options.agentId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--zone") {
      const zone = argv[index + 1] ?? "";
      index += 1;
      if (zone.trim()) options.zones.push(zone.trim());
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--include-current-day") {
      options.includeCurrentDay = true;
      continue;
    }
    if (arg === "--all-zones") {
      options.includeAllZones = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node dist/cli/reconcile-bright-data-costs.js --company-id <companyId> --agent-id <agentId> [--zone <zone>] [--zone <zone>] [--all-zones] [--include-current-day] [--apply]",
          "",
          "Dry-run by default. Requires DATABASE_URL for DB access.",
          "--company-id          Company owning the Bright Data plugin config and target cost events",
          "--agent-id            Agent ID that will own aggregate provider cost events (required with --apply)",
          "--zone                Restrict reconciliation to a specific Bright Data zone (repeatable)",
          "--all-zones           Use all visible zones instead of only the default mcp_* subset",
          "--include-current-day Include back_d0 in addition to finalized daily buckets",
          "--apply               Persist plugin_state updates and write cost_events",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  return options;
}

export async function runBrightDataCostReconcilerCli(argv: string[]) {
  const options = parseArgs(argv);
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!options.companyId) {
    console.error("--company-id is required");
    process.exit(1);
  }
  if (options.apply && !options.agentId) {
    console.error("--agent-id is required when --apply is used");
    process.exit(1);
  }

  const db = createDb(dbUrl);
  const result = await reconcileBrightDataCosts(db, {
    companyId: options.companyId,
    agentId: options.agentId ?? undefined,
    zoneNames: options.zones,
    includeAllZones: options.includeAllZones,
    includeCurrentDay: options.includeCurrentDay,
    apply: options.apply,
  });

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runBrightDataCostReconcilerCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
