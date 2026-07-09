import { sql } from "drizzle-orm";
import { costEvents, costMonthlyRollups } from "@paperclipai/db";

function eventBillableCentsExpr() {
  return sql<number>`case
    when ${costEvents.amountMicros} > 0 then ${costEvents.amountMicros}::double precision / 10000.0
    else ${costEvents.costCents}::double precision
  end`;
}

export function sumBillableCostCentsSql() {
  return sql<number>`coalesce(sum(${eventBillableCentsExpr()}), 0)::double precision`;
}

export function ceilSumBillableCostCentsSql() {
  return sql<number>`ceil(${sumBillableCostCentsSql()})::double precision`;
}

export function sumRollupBillableCostCentsSql() {
  return sql<number>`coalesce(sum(case
    when ${costMonthlyRollups.amountMicros} > 0 then ${costMonthlyRollups.amountMicros}::double precision / 10000.0
    else ${costMonthlyRollups.costCents}::double precision
  end), 0)::double precision`;
}
