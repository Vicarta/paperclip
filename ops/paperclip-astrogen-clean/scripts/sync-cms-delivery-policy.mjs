#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const PLUGIN_KEY = "paperclip.payload-cms-agent-tools";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const POLICY_PATH = resolve(SCRIPT_DIR, "../reference/cms-delivery-policy.yaml");

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function loadPolicy() {
  const source = [
    "import json, pathlib, sys, yaml",
    "print(json.dumps(yaml.safe_load(pathlib.Path(sys.argv[1]).read_text()), ensure_ascii=False))",
  ].join("; ");
  const policy = JSON.parse(run("python3", ["-c", source, POLICY_PATH]));
  if (policy?.version !== "astrogen-cms-delivery-v1") {
    throw new Error("Unsupported CMS delivery policy version");
  }
  if (!policy.defaultEditorialAuthor?.slug || !policy.articleTypeCategoryDefaults) {
    throw new Error("CMS delivery policy is missing required relation defaults");
  }
  return policy;
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

function readCompanySettings() {
  const value = psql(`
    select pcs.settings_json::text
    from plugin_company_settings pcs
    join plugins p on p.id=pcs.plugin_id
    where pcs.company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and p.plugin_key=${sqlLiteral(PLUGIN_KEY)};
  `);
  if (!value) throw new Error(`Company plugin settings not found: ${PLUGIN_KEY}`);
  return JSON.parse(value);
}

function readInstanceConfig() {
  const value = psql(`
    select pc.config_json::text
    from plugin_config pc
    join plugins p on p.id=pc.plugin_id
    where p.plugin_key=${sqlLiteral(PLUGIN_KEY)};
  `);
  if (!value) throw new Error(`Instance plugin config not found: ${PLUGIN_KEY}`);
  return JSON.parse(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameJson(left, right) {
  return stableJson(left) === stableJson(right);
}

async function main() {
  const policy = loadPolicy();
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'cms-delivery-policy-sync', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const beforeCompany = readCompanySettings();
    const beforeInstance = readInstanceConfig();
    const desiredCompany = {
      ...beforeCompany,
      defaultEditorialAuthor: policy.defaultEditorialAuthor,
      articleTypeCategoryDefaults: policy.articleTypeCategoryDefaults,
    };
    const desiredInstance = {
      ...beforeInstance,
      defaultEditorialAuthor: policy.defaultEditorialAuthor,
      articleTypeCategoryDefaults: policy.articleTypeCategoryDefaults,
    };
    const changedCompany = !sameJson(beforeCompany.defaultEditorialAuthor, desiredCompany.defaultEditorialAuthor)
      || !sameJson(beforeCompany.articleTypeCategoryDefaults, desiredCompany.articleTypeCategoryDefaults);
    const changedInstance = !sameJson(beforeInstance.defaultEditorialAuthor, desiredInstance.defaultEditorialAuthor)
      || !sameJson(beforeInstance.articleTypeCategoryDefaults, desiredInstance.articleTypeCategoryDefaults);
    const changed = changedCompany || changedInstance;
    const backup = changed ? await request(token, "POST", "/instance/database-backups", {}) : null;

    if (changedInstance) {
      psql(`
        update plugin_config pc
        set config_json=${sqlLiteral(JSON.stringify(desiredInstance))}::jsonb,
            last_error=null,
            updated_at=now()
        from plugins p
        where pc.plugin_id=p.id
          and p.plugin_key=${sqlLiteral(PLUGIN_KEY)};
      `);
    }
    if (changedCompany) {
      psql(`
        update plugin_company_settings pcs
        set settings_json=${sqlLiteral(JSON.stringify(desiredCompany))}::jsonb,
            last_error=null,
            updated_at=now()
        from plugins p
        where pcs.plugin_id=p.id
          and pcs.company_id=${sqlLiteral(COMPANY_ID)}::uuid
          and p.plugin_key=${sqlLiteral(PLUGIN_KEY)};
      `);
    }

    const afterCompany = readCompanySettings();
    const afterInstance = readInstanceConfig();
    const configurations = [afterCompany, afterInstance];
    if (configurations.some((config) => !sameJson(config.defaultEditorialAuthor, policy.defaultEditorialAuthor)
      || !sameJson(config.articleTypeCategoryDefaults, policy.articleTypeCategoryDefaults))) {
      throw new Error("CMS delivery policy verification failed after sync");
    }

    console.log(JSON.stringify({
      mode: changed ? "applied-and-verified" : "already-current",
      policyVersion: policy.version,
      pluginKey: PLUGIN_KEY,
      defaultEditorialAuthor: afterInstance.defaultEditorialAuthor,
      mappedArticleTypes: Object.keys(afterInstance.articleTypeCategoryDefaults).sort(),
      synchronizedStores: {
        instanceConfig: changedInstance ? "updated" : "current",
        companySettings: changedCompany ? "updated" : "current",
      },
      backup: backup
        ? { filename: backup.filename ?? null, sizeBytes: backup.sizeBytes ?? null, finishedAt: backup.finishedAt ?? null }
        : null,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
