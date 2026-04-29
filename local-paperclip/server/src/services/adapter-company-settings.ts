import { and, eq } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Db } from "@paperclipai/db";

const adapterCompanySettings = pgTable("adapter_company_settings", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  adapterType: text("adapter_type").notNull(),
  settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().notNull().default({}),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

function isMissingAdapterSettingsTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("adapter_company_settings") &&
    (message.includes("does not exist") || message.includes("no such table"))
  );
}

export function adapterCompanySettingsService(db: Db) {
  return {
    get: async (companyId: string, adapterType: string) => {
      try {
        const rows = await db
          .select()
          .from(adapterCompanySettings)
          .where(
            and(
              eq(adapterCompanySettings.companyId, companyId),
              eq(adapterCompanySettings.adapterType, adapterType),
            ),
          )
          .limit(1);
        return rows[0] ?? null;
      } catch (error) {
        if (isMissingAdapterSettingsTable(error)) return null;
        throw error;
      }
    },
  };
}
