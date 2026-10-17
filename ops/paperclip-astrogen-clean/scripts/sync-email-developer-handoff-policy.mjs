#!/usr/bin/env node
/**
 * Converges the clean Astrogen email-plugin policy without exposing existing
 * transport secrets. Developer handoffs are limited to public site hosts; a
 * Paperclip runtime or agent-contract failure must remain an internal recovery.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_KEY = "paperclip.email-notifications";
const ALLOWED_HOSTS = "astrogen.com.ua,cms.astrogen.com.ua";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"], sql);
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const verify = args.includes("--verify");
  if (args.some((argument) => !["--apply", "--verify"].includes(argument))) {
    throw new Error("Usage: sync-email-developer-handoff-policy.mjs [--apply] [--verify]");
  }
  return { apply, verify };
}

function readConfig(scope) {
  const from = scope === "company" ? "plugin_company_settings pcs" : "plugin_config pc";
  const select = scope === "company" ? "pcs.settings_json" : "pc.config_json";
  const companyClause = scope === "company" ? `and pcs.company_id=${literal(COMPANY_ID)}::uuid` : "";
  const value = psql(`
    select ${select}::text
    from ${from}
    join plugins p on p.id=${scope === "company" ? "pcs.plugin_id" : "pc.plugin_id"}
    where p.plugin_key=${literal(PLUGIN_KEY)} ${companyClause};
  `);
  if (!value) throw new Error(`${scope} email-plugin config is missing`);
  return JSON.parse(value);
}

function compactSummary(config) {
  return {
    configured: typeof config.developerHandoffAllowedHosts === "string",
    developerHandoffAllowedHosts: config.developerHandoffAllowedHosts ?? null,
    recipientCount: String(config.defaultRecipientEmails ?? "").split(/[,\n;]/).filter(Boolean).length,
    hasResendSecretRef: typeof config.resendApiKeySecretRef === "string" && config.resendApiKeySecretRef.length > 0,
  };
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const { apply, verify } = parseArgs();
  const currentInstance = readConfig("instance");
  const currentCompany = readConfig("company");
  const desiredInstance = { ...currentInstance, developerHandoffAllowedHosts: ALLOWED_HOSTS };
  const desiredCompany = { ...currentCompany, developerHandoffAllowedHosts: ALLOWED_HOSTS };
  const instanceChanged = JSON.stringify(currentInstance) !== JSON.stringify(desiredInstance);
  const companyChanged = JSON.stringify(currentCompany) !== JSON.stringify(desiredCompany);

  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      instanceChanged,
      companyChanged,
      current: { instance: compactSummary(currentInstance), company: compactSummary(currentCompany) },
      desiredAllowedHosts: ALLOWED_HOSTS,
    }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${literal(keyId)}::uuid,${literal(USER_ID)},'email-developer-handoff-policy-sync',${literal(createHash("sha256").update(token).digest("hex"))},now()+interval '20 minutes');`);
  try {
    const backup = instanceChanged || companyChanged ? await request(token, "POST", "/instance/database-backups", {}) : null;
    if (instanceChanged) {
      psql(`
        update plugin_config pc set config_json=${literal(JSON.stringify(desiredInstance))}::jsonb,last_error=null,updated_at=now()
        from plugins p where pc.plugin_id=p.id and p.plugin_key=${literal(PLUGIN_KEY)};
      `);
    }
    if (companyChanged) {
      psql(`
        update plugin_company_settings pcs set settings_json=${literal(JSON.stringify(desiredCompany))}::jsonb,last_error=null,updated_at=now()
        from plugins p where pcs.plugin_id=p.id and p.plugin_key=${literal(PLUGIN_KEY)} and pcs.company_id=${literal(COMPANY_ID)}::uuid;
      `);
    }
    const verifiedInstance = readConfig("instance");
    const verifiedCompany = readConfig("company");
    if (verifiedInstance.developerHandoffAllowedHosts !== ALLOWED_HOSTS || verifiedCompany.developerHandoffAllowedHosts !== ALLOWED_HOSTS) {
      throw new Error("email developer-handoff policy did not persist");
    }
    console.log(JSON.stringify({
      mode: "apply",
      instanceChanged,
      companyChanged,
      backup,
      verified: { instance: compactSummary(verifiedInstance), company: compactSummary(verifiedCompany) },
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${literal(keyId)}::uuid;`);
  }

  if (verify) console.log(JSON.stringify({ verified: true, allowedHosts: ALLOWED_HOSTS }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
