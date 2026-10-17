#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'owner-rejected-cms-draft-removal',
      ${q(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    const assigneeAgentId = psql(`
      select id from agents
      where company_id=${q(COMPANY_ID)}::uuid and name='Chief Marketing Officer' and status<>'terminated'
      order by created_at limit 1;
    `);
    const goalId = psql(`select goal_id from projects where id=${q(PROJECT_ID)}::uuid;`);
    if (!assigneeAgentId || !goalId) throw new Error("CMO or project goal is missing");

    const issue = await request(token, "POST", `/companies/${COMPANY_ID}/issues`, {
      title: "Remove owner-rejected date and daily-horoscope CMS drafts",
      description: [
        "Owner decision: remove the two recent unpublished editorial drafts that violate the evergreen topic policy.",
        "",
        "CMO is the manager and must delegate one bounded child to SEO CMS Technical Fixer. CMO must not perform the CMS deletion directly.",
        "",
        "Exact targets:",
        "- CMS 128: 22 травня знак зодіаку: Близнюки, межа з Тельцем і що справді варто врахувати",
        "- CMS 131: Гороскоп Водолія на сьогодні",
        "",
        "Required execution:",
        "1. The child refetches each target through Payload CMS, records exact slug/title/status, and confirms it is unpublished, unapproved, and not previously published.",
        "2. The child calls `payload_cms_delete_owner_rejected_blog_post_draft` once per confirmed target with exact id, expectedSlug, expectedTitle, `confirmOwnerApprovedDraftDeletion=true`, and this parent AST identifier as ownerDecisionRef.",
        "3. The child refetches or lists CMS inventory and proves both targets are absent. Never delete any other CMS item.",
        "4. CMO records owner rejection and CMS deletion proof on the existing article cases. Preserve consumed topic history so these fingerprints cannot be allocated again; do not create replacement article tasks manually.",
        "5. CMO verifies no unrelated CMS item was deleted and sends one gender-neutral Telegram completion message containing only affected CMS admin edit URLs or a concise no-link completion note.",
        "",
        "System policy: explicit calendar-date and ephemeral daily-horoscope topics are paused. Trend-derived drafts must also be rejected when Paperclip narrowed an audience trend into a product/service/modality title, H1, slug, primary keyword, topicKey, or refresh owner.",
        "",
        "## ownerRejectedDraftRemovalResult",
        "```json",
        JSON.stringify({
          status: "pending",
          targetCmsIds: [128, 131],
          preserveCmsIds: [],
          ownerPolicyReasons: [
            "owner_policy_calendar_date_topics_paused",
            "owner_policy_ephemeral_daily_horoscope_paused",
            "owner_policy_product_narrowing_contamination_forbidden",
          ],
        }, null, 2),
        "```",
      ].join("\n"),
      status: "todo",
      priority: "high",
      assigneeAgentId,
      projectId: PROJECT_ID,
      goalId,
    });

    process.stdout.write(`${JSON.stringify({
      ok: true,
      issueId: issue.id,
      identifier: issue.identifier,
      assigneeAgentId,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
