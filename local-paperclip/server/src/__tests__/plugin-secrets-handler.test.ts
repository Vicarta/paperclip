import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  companies,
  companySecretBindings,
  companySecretProviderConfigs,
  companySecretVersions,
  companySecrets,
  createDb,
  pluginConfig,
  plugins,
  secretAccessEvents,
} from "@paperclipai/db";
import { createPluginSecretsHandler } from "../services/plugin-secrets-handler.js";
import { secretService } from "../services/secrets.js";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin secrets handler tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("createPluginSecretsHandler", () => {
  let stopDb: (() => Promise<void>) | null = null;
  let db!: ReturnType<typeof createDb>;
  const previousKeyFile = process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE;
  const secretsTmpDir = path.join(os.tmpdir(), `paperclip-plugin-secrets-${randomUUID()}`);

  beforeAll(async () => {
    mkdirSync(secretsTmpDir, { recursive: true });
    process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = path.join(secretsTmpDir, "master.key");
    const started = await startEmbeddedPostgresTestDatabase("plugin-secrets-handler");
    stopDb = started.cleanup;
    db = createDb(started.connectionString);
  });

  afterEach(async () => {
    await db.delete(secretAccessEvents);
    await db.delete(companySecretBindings);
    await db.delete(companySecretVersions);
    await db.delete(companySecrets);
    await db.delete(companySecretProviderConfigs);
    await db.delete(pluginConfig);
    await db.delete(plugins);
    await db.delete(companies);
  });

  afterAll(async () => {
    await stopDb?.();
    if (previousKeyFile === undefined) {
      delete process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE;
    } else {
      process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = previousKeyFile;
    }
    rmSync(secretsTmpDir, { recursive: true, force: true });
  });

  async function seedCompany(name = "Acme") {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name,
      issuePrefix: `T${companyId.slice(0, 7)}`.toUpperCase(),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return companyId;
  }

  async function seedPlugin(configJson: Record<string, unknown>) {
    const pluginId = randomUUID();
    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: `test.plugin.${pluginId}`,
      packageName: "test-plugin",
      version: "0.0.0",
      apiVersion: 1,
      categories: [],
      manifestJson: {
        apiVersion: 1,
        id: "test.plugin",
        name: "Test Plugin",
        version: "0.0.0",
        capabilities: ["secrets.read-ref"],
        instanceConfigSchema: {
          type: "object",
          properties: {
            tokenSecretRef: {
              type: "string",
              format: "secret-ref",
            },
          },
        },
      } as never,
      status: "ready",
      installedAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(pluginConfig).values({
      pluginId,
      configJson,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return pluginId;
  }

  it("resolves a plugin secret ref only when the ref is declared in that plugin config", async () => {
    const companyId = await seedCompany();
    const secret = await secretService(db).create(companyId, {
      name: `plugin-token-${randomUUID()}`,
      provider: "local_encrypted",
      value: "runtime-secret",
    });
    const pluginId = await seedPlugin({ tokenSecretRef: secret.id });

    const handler = createPluginSecretsHandler({ db, pluginId });

    await expect(handler.resolve({ secretRef: secret.id })).resolves.toBe("runtime-secret");
  });

  it("rejects a UUID that is not present in the plugin config", async () => {
    const companyId = await seedCompany();
    const declaredSecret = await secretService(db).create(companyId, {
      name: `declared-${randomUUID()}`,
      provider: "local_encrypted",
      value: "declared-secret",
    });
    const undeclaredSecret = await secretService(db).create(companyId, {
      name: `undeclared-${randomUUID()}`,
      provider: "local_encrypted",
      value: "undeclared-secret",
    });
    const pluginId = await seedPlugin({ tokenSecretRef: declaredSecret.id });

    const handler = createPluginSecretsHandler({ db, pluginId });

    await expect(handler.resolve({ secretRef: undeclaredSecret.id })).rejects.toThrow(
      /not declared in this plugin config/i,
    );
  });

  it("rejects malformed secret refs before database lookup", async () => {
    const handler = createPluginSecretsHandler({
      db,
      pluginId: "11111111-1111-4111-8111-111111111111",
    });

    await expect(
      handler.resolve({ secretRef: "not-a-uuid" }),
    ).rejects.toThrow(/invalid secret reference/i);
  });
});
