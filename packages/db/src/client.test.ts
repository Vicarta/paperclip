import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  applyPendingMigrations,
  inspectMigrations,
} from "./client.js";
import {
  getEmbeddedPostgresTestSupport,
  startBlankEmbeddedPostgresTestDatabase,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function createTempDatabase(): Promise<string> {
  const db = await startEmbeddedPostgresTestDatabase("paperclip-db-client-");
  cleanups.push(db.cleanup);
  return db.connectionString;
}

async function createBlankTempDatabase(): Promise<string> {
  const db = await startBlankEmbeddedPostgresTestDatabase("paperclip-db-client-blank-");
  cleanups.push(db.cleanup);
  return db.connectionString;
}

async function migrationHash(migrationFile: string): Promise<string> {
  const content = await fs.promises.readFile(
    new URL(`./migrations/${migrationFile}`, import.meta.url),
    "utf8",
  );
  return createHash("sha256").update(content).digest("hex");
}

function splitMigrationStatements(content: string): string[] {
  return content
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function readCurrentJournalEntries(): Promise<Array<{ fileName: string; folderMillis: number }>> {
  const raw = await fs.promises.readFile(new URL("./migrations/meta/_journal.json", import.meta.url), "utf8");
  const parsed = JSON.parse(raw) as {
    entries?: Array<{ tag?: string; when?: number }>;
  };
  return (parsed.entries ?? [])
    .map((entry) => {
      if (typeof entry.tag !== "string" || typeof entry.when !== "number") return null;
      return { fileName: `${entry.tag}.sql`, folderMillis: entry.when };
    })
    .filter((entry): entry is { fileName: string; folderMillis: number } => entry !== null);
}

async function applyMigrationWithHistory(
  sql: ReturnType<typeof postgres>,
  migrationFile: string,
  migrationContent: string,
  folderMillis: number,
): Promise<void> {
  const hash = createHash("sha256").update(migrationContent).digest("hex");
  await sql.unsafe("BEGIN");
  try {
    for (const statement of splitMigrationStatements(migrationContent)) {
      await sql.unsafe(statement);
    }
    await sql.unsafe(
      `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
      [hash, String(folderMillis)],
    );
    await sql.unsafe("COMMIT");
  } catch (error) {
    await sql.unsafe("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function buildVicartaLegacyUsdSchema(connectionString: string): Promise<void> {
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" ("id" SERIAL PRIMARY KEY, "hash" text NOT NULL, "created_at" bigint)`,
    );

    const journalEntries = await readCurrentJournalEntries();
    const cutoffFile = "0029_plugin_tables.sql";
    for (const entry of journalEntries) {
      if (entry.fileName > cutoffFile) break;
      const content = await fs.promises.readFile(
        new URL(`./migrations/${entry.fileName}`, import.meta.url),
        "utf8",
      );
      await applyMigrationWithHistory(sql, entry.fileName, content, entry.folderMillis);
    }

    const legacyMigrations: Array<{ fileName: string; content: string; folderMillis: number }> = [
      {
        fileName: "0030_project_human_facing_language.sql",
        content: `ALTER TABLE "projects" ADD COLUMN "human_facing_language" text;`,
        folderMillis: 1774978636660,
      },
      {
        fileName: "0031_adapter_company_settings.sql",
        content: `CREATE TABLE "adapter_company_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "adapter_type" text NOT NULL,
  "settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adapter_company_settings" ADD CONSTRAINT "adapter_company_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "adapter_company_settings_company_idx" ON "adapter_company_settings" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "adapter_company_settings_adapter_type_idx" ON "adapter_company_settings" USING btree ("adapter_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "adapter_company_settings_company_adapter_type_uq" ON "adapter_company_settings" USING btree ("company_id","adapter_type");`,
        folderMillis: 1774978636661,
      },
      {
        fileName: "0032_cost_events_usd.sql",
        content: `ALTER TABLE "cost_events" RENAME COLUMN "cost_cents" TO "cost_usd";
--> statement-breakpoint
ALTER TABLE "cost_events"
  ALTER COLUMN "cost_usd" TYPE double precision
  USING ("cost_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "companies" RENAME COLUMN "budget_monthly_cents" TO "budget_monthly_usd";
--> statement-breakpoint
ALTER TABLE "companies" RENAME COLUMN "spent_monthly_cents" TO "spent_monthly_usd";
--> statement-breakpoint
ALTER TABLE "companies"
  ALTER COLUMN "budget_monthly_usd" TYPE double precision
  USING ("budget_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "companies"
  ALTER COLUMN "spent_monthly_usd" TYPE double precision
  USING ("spent_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "agents" RENAME COLUMN "budget_monthly_cents" TO "budget_monthly_usd";
--> statement-breakpoint
ALTER TABLE "agents" RENAME COLUMN "spent_monthly_cents" TO "spent_monthly_usd";
--> statement-breakpoint
ALTER TABLE "agents"
  ALTER COLUMN "budget_monthly_usd" TYPE double precision
  USING ("budget_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "agents"
  ALTER COLUMN "spent_monthly_usd" TYPE double precision
  USING ("spent_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "agent_runtime_state" RENAME COLUMN "total_cost_cents" TO "total_cost_usd";
--> statement-breakpoint
ALTER TABLE "agent_runtime_state"
  ALTER COLUMN "total_cost_usd" TYPE double precision
  USING ("total_cost_usd"::double precision / 100.0);`,
        folderMillis: 1774978636662,
      },
    ];

    for (const entry of legacyMigrations) {
      await applyMigrationWithHistory(sql, entry.fileName, entry.content, entry.folderMillis);
    }
  } finally {
    await sql.end();
  }
}

async function applySqlFile(connectionString: string, absoluteFilePath: string): Promise<void> {
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    const content = await fs.promises.readFile(absoluteFilePath, "utf8");
    for (const statement of splitMigrationStatements(content)) {
      await sql.unsafe(statement);
    }
  } finally {
    await sql.end();
  }
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres migration tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("applyPendingMigrations", () => {
  it(
    "requires the preflight bridge for a legacy Vicarta USD-first schema and then converges successfully",
    async () => {
      const withoutBridgeConnection = await createBlankTempDatabase();
      await buildVicartaLegacyUsdSchema(withoutBridgeConnection);

      const pendingState = await inspectMigrations(withoutBridgeConnection);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: expect.arrayContaining(["0030_rich_magneto.sql", "0031_zippy_magma.sql", "0032_pretty_doctor_octopus.sql"]),
        reason: "pending-migrations",
      });

      await expect(applyPendingMigrations(withoutBridgeConnection)).rejects.toThrow();

      const withBridgeConnection = await createBlankTempDatabase();
      await buildVicartaLegacyUsdSchema(withBridgeConnection);

      const bridgePath = path.resolve(
        process.cwd(),
        "../../docs/deploy/sql/upstream-v2026-403-0-preflight-schema-bridge.sql",
      );
      await applySqlFile(withBridgeConnection, bridgePath);

      const sql = postgres(withBridgeConnection, { max: 1, onnotice: () => {} });
      try {
        const bridgeColumns = await sql.unsafe<{ table_name: string; column_name: string }[]>(
          `
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND (
                (table_name = 'companies' AND column_name IN ('budget_monthly_cents', 'spent_monthly_cents'))
                OR (table_name = 'agents' AND column_name IN ('budget_monthly_cents', 'spent_monthly_cents'))
                OR (table_name = 'cost_events' AND column_name = 'cost_cents')
                OR (table_name = 'agent_runtime_state' AND column_name = 'total_cost_cents')
              )
            ORDER BY table_name, column_name
          `,
        );
        expect(bridgeColumns).toEqual([
          { table_name: "agent_runtime_state", column_name: "total_cost_cents" },
          { table_name: "agents", column_name: "budget_monthly_cents" },
          { table_name: "agents", column_name: "spent_monthly_cents" },
          { table_name: "companies", column_name: "budget_monthly_cents" },
          { table_name: "companies", column_name: "spent_monthly_cents" },
          { table_name: "cost_events", column_name: "cost_cents" },
        ]);
      } finally {
        await sql.end();
      }

      await applyPendingMigrations(withBridgeConnection);

      const finalState = await inspectMigrations(withBridgeConnection);
      expect(finalState.status).toBe("upToDate");
    },
    40_000,
  );

  it(
    "applies an inserted earlier migration without replaying later legacy migrations",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const richMagnetoHash = await migrationHash("0030_rich_magneto.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${richMagnetoHash}'`,
        );
        await sql.unsafe(`DROP TABLE "company_logos"`);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0030_rich_magneto.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");

      const verifySql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const rows = await verifySql.unsafe<{ table_name: string }[]>(
          `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('company_logos', 'execution_workspaces')
            ORDER BY table_name
          `,
        );
        expect(rows.map((row) => row.table_name)).toEqual([
          "company_logos",
          "execution_workspaces",
        ]);
      } finally {
        await verifySql.end();
      }
    },
    20_000,
  );

  it(
    "replays migration 0044 safely when its schema changes already exist",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const illegalToadHash = await migrationHash("0044_illegal_toad.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${illegalToadHash}'`,
        );

        const columns = await sql.unsafe<{ column_name: string }[]>(
          `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'instance_settings'
              AND column_name = 'general'
          `,
        );
        expect(columns).toHaveLength(1);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0044_illegal_toad.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");
    },
    20_000,
  );

  it(
    "enforces a unique board_api_keys.key_hash after migration 0044",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        await sql.unsafe(`
          INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
          VALUES ('user-1', 'User One', 'user@example.com', true, now(), now())
        `);
        await sql.unsafe(`
          INSERT INTO "board_api_keys" ("id", "user_id", "name", "key_hash", "created_at")
          VALUES ('00000000-0000-0000-0000-000000000001', 'user-1', 'Key One', 'dup-hash', now())
        `);
        await expect(
          sql.unsafe(`
            INSERT INTO "board_api_keys" ("id", "user_id", "name", "key_hash", "created_at")
            VALUES ('00000000-0000-0000-0000-000000000002', 'user-1', 'Key Two', 'dup-hash', now())
          `),
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    },
    20_000,
  );

  it(
    "replays migration 0046 safely when document revision columns already exist",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const smoothSentinelsHash = await migrationHash("0046_smooth_sentinels.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${smoothSentinelsHash}'`,
        );

        const columns = await sql.unsafe<{ column_name: string; is_nullable: string; column_default: string | null }[]>(
          `
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'document_revisions'
              AND column_name IN ('title', 'format')
            ORDER BY column_name
          `,
        );
        expect(columns).toHaveLength(2);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0046_smooth_sentinels.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");

      const verifySql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const columns = await verifySql.unsafe<{ column_name: string; is_nullable: string; column_default: string | null }[]>(
          `
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'document_revisions'
              AND column_name IN ('title', 'format')
            ORDER BY column_name
          `,
        );
        expect(columns).toEqual([
          expect.objectContaining({
            column_name: "format",
            is_nullable: "NO",
          }),
          expect.objectContaining({
            column_name: "title",
            is_nullable: "YES",
          }),
        ]);
        expect(columns[0]?.column_default).toContain("'markdown'");
      } finally {
        await verifySql.end();
      }
    },
    20_000,
  );

  it(
    "replays migration 0047 safely when feedback tables and run columns already exist",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const overjoyedGrootHash = await migrationHash("0047_overjoyed_groot.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${overjoyedGrootHash}'`,
        );

        const tables = await sql.unsafe<{ table_name: string }[]>(
          `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('feedback_exports', 'feedback_votes')
            ORDER BY table_name
          `,
        );
        expect(tables.map((row) => row.table_name)).toEqual([
          "feedback_exports",
          "feedback_votes",
        ]);

        const columns = await sql.unsafe<{ table_name: string; column_name: string }[]>(
          `
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND (
                (table_name = 'companies' AND column_name IN (
                  'feedback_data_sharing_enabled',
                  'feedback_data_sharing_consent_at',
                  'feedback_data_sharing_consent_by_user_id',
                  'feedback_data_sharing_terms_version'
                ))
                OR (table_name = 'document_revisions' AND column_name = 'created_by_run_id')
                OR (table_name = 'issue_comments' AND column_name = 'created_by_run_id')
              )
            ORDER BY table_name, column_name
          `,
        );
        expect(columns).toHaveLength(6);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0047_overjoyed_groot.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");

      const verifySql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const constraints = await verifySql.unsafe<{ conname: string }[]>(
          `
            SELECT conname
            FROM pg_constraint
            WHERE conname IN (
              'feedback_exports_company_id_companies_id_fk',
              'feedback_exports_feedback_vote_id_feedback_votes_id_fk',
              'feedback_exports_issue_id_issues_id_fk',
              'feedback_votes_company_id_companies_id_fk',
              'feedback_votes_issue_id_issues_id_fk'
            )
            ORDER BY conname
          `,
        );
        expect(constraints.map((row) => row.conname)).toEqual([
          "feedback_exports_company_id_companies_id_fk",
          "feedback_exports_feedback_vote_id_feedback_votes_id_fk",
          "feedback_exports_issue_id_issues_id_fk",
          "feedback_votes_company_id_companies_id_fk",
          "feedback_votes_issue_id_issues_id_fk",
        ]);
      } finally {
        await verifySql.end();
      }
    },
    20_000,
  );

  it(
    "replays migration 0048 safely when routines.variables already exists",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const flashyMarrowHash = await migrationHash("0048_flashy_marrow.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${flashyMarrowHash}'`,
        );

        const columns = await sql.unsafe<{ column_name: string }[]>(
          `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'routines'
              AND column_name = 'variables'
          `,
        );
        expect(columns).toHaveLength(1);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0048_flashy_marrow.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");

      const verifySql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const columns = await verifySql.unsafe<{ column_name: string; is_nullable: string; data_type: string }[]>(
          `
            SELECT column_name, is_nullable, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'routines'
              AND column_name = 'variables'
          `,
        );
        expect(columns).toEqual([
          expect.objectContaining({
            column_name: "variables",
            is_nullable: "NO",
            data_type: "jsonb",
          }),
        ]);
      } finally {
        await verifySql.end();
      }
    },
    20_000,
  );
});
