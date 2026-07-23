#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  throw new Error("Usage: verify-linked-work-terminal-wake-dist.mjs <compiled-issues.js>");
}

const functionMarker = "async function scheduleLatestCaseAutomationWakeForTerminalWork(";
const functionAnchor = "const ALL_ISSUE_STATUSES =";
const callMarker = "await scheduleLatestCaseAutomationWakeForTerminalWork(tx, existing, issueData.status);";
const callAnchor = `                return enriched;
            };
            return dbOrTx === db ? db.transaction(runUpdate) : runUpdate(dbOrTx);`;
const helper = `async function scheduleLatestCaseAutomationWakeForTerminalWork(dbOrTx, issue, terminalStatus) {
    const linkedCases = await dbOrTx
        .selectDistinct({ caseId: pipelineCaseIssueLinks.caseId })
        .from(pipelineCaseIssueLinks)
        .where(and(eq(pipelineCaseIssueLinks.companyId, issue.companyId), eq(pipelineCaseIssueLinks.issueId, issue.id), eq(pipelineCaseIssueLinks.role, "work"), isNull(pipelineCaseIssueLinks.retiredAt)));
    if (linkedCases.length === 0)
        return;
    const now = new Date();
    for (const linkedCase of linkedCases) {
        const latestAutomation = await dbOrTx
            .select({ issueId: issues.id })
            .from(pipelineCaseIssueLinks)
            .innerJoin(issues, and(eq(pipelineCaseIssueLinks.issueId, issues.id), eq(pipelineCaseIssueLinks.companyId, issues.companyId)))
            .where(and(eq(pipelineCaseIssueLinks.companyId, issue.companyId), eq(pipelineCaseIssueLinks.caseId, linkedCase.caseId), eq(pipelineCaseIssueLinks.role, "automation"), isNull(pipelineCaseIssueLinks.retiredAt), eq(issues.companyId, issue.companyId), inArray(issues.status, ["in_progress", "in_review"]), isNull(issues.hiddenAt)))
            .orderBy(desc(pipelineCaseIssueLinks.createdAt), desc(pipelineCaseIssueLinks.id))
            .limit(1)
            .then((rows) => rows[0] ?? null);
        if (!latestAutomation)
            continue;
        const [scheduled] = await dbOrTx
            .update(issues)
            .set({
            monitorNextCheckAt: now,
            monitorWakeRequestedAt: null,
            monitorScheduledBy: "system:linked_work_terminal",
            monitorNotes: \`Linked work issue \${issue.identifier ?? issue.id} became \${terminalStatus}; re-read case-visible outputs and continue.\`,
            updatedAt: now,
        })
            .where(and(eq(issues.id, latestAutomation.issueId), eq(issues.companyId, issue.companyId), inArray(issues.status, ["in_progress", "in_review"])))
            .returning({ id: issues.id });
        if (!scheduled)
            continue;
        await dbOrTx.insert(pipelineCaseEvents).values({
            companyId: issue.companyId,
            caseId: linkedCase.caseId,
            type: "updated",
            actorType: "system",
            payload: {
                kind: "linked_work_terminal_wake_scheduled",
                workIssueId: issue.id,
                workIssueIdentifier: issue.identifier,
                workIssueStatus: terminalStatus,
                automationIssueId: latestAutomation.issueId,
            },
        });
    }
}
`;
const call = `                if ((issueData.status === "done" || issueData.status === "cancelled") &&
                    existing.status !== issueData.status) {
                    await scheduleLatestCaseAutomationWakeForTerminalWork(tx, existing, issueData.status);
                }
`;

let source = readFileSync(target, "utf8");
if (!source.includes(functionMarker)) {
  if (!source.includes(functionAnchor)) {
    throw new Error("Linked-work terminal wake function anchor is missing");
  }
  source = source.replace(functionAnchor, `${helper}${functionAnchor}`);
}
if (!source.includes(callMarker)) {
  if (!source.includes(callAnchor)) {
    throw new Error("Linked-work terminal wake call anchor is missing");
  }
  source = source.replace(callAnchor, `${call}${callAnchor}`);
}
source = source.replace(
  'type: "linked_work_terminal_wake_scheduled",\n            actorType: "system",',
  'type: "updated",\n            actorType: "system",',
);
source = source.replace(
  'payload: {\n                workIssueId: issue.id,\n                workIssueIdentifier: issue.identifier,\n                workIssueStatus: terminalStatus,\n                automationIssueId: latestAutomation.issueId,',
  'payload: {\n                kind: "linked_work_terminal_wake_scheduled",\n                workIssueId: issue.id,\n                workIssueIdentifier: issue.identifier,\n                workIssueStatus: terminalStatus,\n                automationIssueId: latestAutomation.issueId,',
);
writeFileSync(target, source);

const verified = readFileSync(target, "utf8");
const markers = [
  "scheduleLatestCaseAutomationWakeForTerminalWork",
  "system:linked_work_terminal",
  'type: "updated"',
  'kind: "linked_work_terminal_wake_scheduled"',
  "monitorNextCheckAt: now",
];
for (const marker of markers) {
  if (!verified.includes(marker)) {
    throw new Error(`Linked-work terminal wake marker is missing: ${marker}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  target,
  status: "linked-work-terminal-wake-patched-or-verified",
}));
