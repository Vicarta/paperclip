import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { adapterCompanySettings } from "@paperclipai/db";

export function adapterCompanySettingsService(db: Db) {
  return {
    get: async (companyId: string, adapterType: string) => {
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
    },

    upsert: async (
      companyId: string,
      adapterType: string,
      settingsJson: Record<string, unknown>,
      lastError?: string | null,
    ) => {
      const rows = await db
        .insert(adapterCompanySettings)
        .values({
          companyId,
          adapterType,
          settingsJson,
          lastError: lastError ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [adapterCompanySettings.companyId, adapterCompanySettings.adapterType],
          set: {
            settingsJson,
            lastError: lastError ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return rows[0] ?? null;
    },
  };
}
