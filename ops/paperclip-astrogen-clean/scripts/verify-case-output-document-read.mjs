#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASE_ID = process.env.PAPERCLIP_CASE_ID ?? "45bbd736-b3c5-4f4a-995c-748b7e2aef28";
const SOURCE_ISSUE_IDENTIFIER = process.env.PAPERCLIP_SOURCE_ISSUE ?? "AST-275";
const DOCUMENT_KEY = process.env.PAPERCLIP_DOCUMENT_KEY ?? "completion-evidence";

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

async function request(token, pathname) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GET ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return parsed;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-case-output-read-verification', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const [outputs, contextPack] = await Promise.all([
      request(token, `/cases/${CASE_ID}/outputs`),
      request(token, `/cases/${CASE_ID}/context-pack`),
    ]);
    const item = outputs.items.find((candidate) =>
      candidate.kind === "document"
      && candidate.sourceIssueIdentifier === SOURCE_ISSUE_IDENTIFIER
      && candidate.documentKey === DOCUMENT_KEY
    );
    if (!item) throw new Error(`Output document ${SOURCE_ISSUE_IDENTIFIER}/${DOCUMENT_KEY} not found`);
    const summary = contextPack.outputSummaries.items.find((candidate) => candidate.id === item.id);
    const expectedPath = `/api/cases/${CASE_ID}/outputs/documents/${item.documentId}`;
    if (!summary?.fetchHint?.includes(expectedPath)) throw new Error("Context fetch hint is not case-scoped");

    const full = await request(token, `/cases/${CASE_ID}/outputs/documents/${item.documentId}`);
    const body = full.document?.body ?? "";
    const topicKeys = body.match(/`topic:[^`]+`/g) ?? [];
    if (full.document?.bodyRedacted) throw new Error("Expected trusted completion evidence, got a redacted body");
    if (topicKeys.length < 3 || !body.includes("Stage: `ready`")) {
      throw new Error("Full completion evidence is incomplete or still truncated");
    }

    console.log(JSON.stringify({
      mode: "case-scoped-output-read-verified",
      companyId: COMPANY_ID,
      caseId: CASE_ID,
      sourceIssueIdentifier: SOURCE_ISSUE_IDENTIFIER,
      documentId: item.documentId,
      documentKey: item.documentKey,
      bodyChars: body.length,
      topicKeyCount: topicKeys.length,
      fetchPath: expectedPath,
      bodyRedacted: false,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
