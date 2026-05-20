import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  companies,
  companySecrets,
  companySecretVersions,
  createDb,
} from "@paperclipai/db";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import { secretService } from "../services/secrets.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres secret service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("secretService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const originalMasterKey = process.env.PAPERCLIP_SECRETS_MASTER_KEY;

  beforeAll(async () => {
    process.env.PAPERCLIP_SECRETS_MASTER_KEY = Buffer.alloc(32, 9).toString("base64");
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-secrets-service-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(companySecretVersions);
    await db.delete(companySecrets);
    await db.delete(companies);
  });

  afterAll(async () => {
    if (originalMasterKey === undefined) {
      delete process.env.PAPERCLIP_SECRETS_MASTER_KEY;
    } else {
      process.env.PAPERCLIP_SECRETS_MASTER_KEY = originalMasterKey;
    }
    await tempDb?.cleanup();
  });

  async function seedCompany() {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Astrogen",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    return companyId;
  }

  it("creates local encrypted secrets with the reconciled metadata schema", async () => {
    const companyId = await seedCompany();

    const secret = await secretService(db).create(companyId, {
      name: "Payload CMS API Key",
      provider: "local_encrypted",
      value: "payload-key-v1",
    });

    expect(secret.key).toBe("payload-cms-api-key");
    expect(secret.status).toBe("active");
    expect(secret.managedMode).toBe("paperclip_managed");
    expect(secret.latestVersion).toBe(1);
    expect(secret.lastRotatedAt).toBeInstanceOf(Date);

    const version = await db
      .select()
      .from(companySecretVersions)
      .where(and(
        eq(companySecretVersions.secretId, secret.id),
        eq(companySecretVersions.version, 1),
      ))
      .then((rows) => rows[0]);

    expect(version?.status).toBe("current");
    expect(version?.fingerprintSha256).toBe(version?.valueSha256);
    await expect(secretService(db).resolveSecretValue(companyId, secret.id, "latest")).resolves.toBe("payload-key-v1");
  });

  it("rotates secrets and keeps only the latest version current", async () => {
    const companyId = await seedCompany();
    const svc = secretService(db);
    const secret = await svc.create(companyId, {
      name: "Payload CMS API Key",
      provider: "local_encrypted",
      value: "payload-key-v1",
    });

    const rotated = await svc.rotate(secret.id, { value: "payload-key-v2" });

    expect(rotated.latestVersion).toBe(2);
    await expect(svc.resolveSecretValue(companyId, secret.id, "latest")).resolves.toBe("payload-key-v2");

    const versions = await db
      .select()
      .from(companySecretVersions)
      .where(eq(companySecretVersions.secretId, secret.id));

    expect(versions.find((version) => version.version === 1)?.status).toBe("previous");
    expect(versions.find((version) => version.version === 2)?.status).toBe("current");
  });
});
