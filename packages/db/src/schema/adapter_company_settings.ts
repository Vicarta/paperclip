import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const adapterCompanySettings = pgTable(
  "adapter_company_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    adapterType: text("adapter_type").notNull(),
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().notNull().default({}),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("adapter_company_settings_company_idx").on(table.companyId),
    adapterTypeIdx: index("adapter_company_settings_adapter_type_idx").on(table.adapterType),
    companyAdapterTypeUq: uniqueIndex("adapter_company_settings_company_adapter_type_uq").on(
      table.companyId,
      table.adapterType,
    ),
  }),
);
