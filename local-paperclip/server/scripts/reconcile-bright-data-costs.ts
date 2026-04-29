import { runBrightDataCostReconcilerCli } from "../src/cli/reconcile-bright-data-costs.ts";

void runBrightDataCostReconcilerCli(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
