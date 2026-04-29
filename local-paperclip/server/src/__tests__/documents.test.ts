import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, documentRevisions, documents, issueDocuments, issues } from "@paperclipai/db";
import { extractLegacyPlanBody } from "../services/documents.js";
import { documentService } from "../services/documents.ts";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

describe("extractLegacyPlanBody", () => {
  it("returns null when no plan block exists", () => {
    expect(extractLegacyPlanBody("hello world")).toBeNull();
  });

  it("extracts plan body from legacy issue descriptions", () => {
    expect(
      extractLegacyPlanBody(`
intro

<plan>

# Plan

- one
- two

</plan>
      `),
    ).toBe("# Plan\n\n- one\n- two");
  });

  it("ignores empty plan blocks", () => {
    expect(extractLegacyPlanBody("<plan>   </plan>")).toBeNull();
  });
});

describeEmbeddedPostgres("documentService.restoreIssueDocumentRevision", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof documentService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-documents-service-");
    db = createDb(tempDb.connectionString);
    svc = documentService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(documentRevisions);
    await db.delete(issueDocuments);
    await db.delete(documents);
    await db.delete(issues);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("returns the restored body in the response payload and persists it as latest state", async () => {
    const companyId = randomUUID();
    const issueId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "AST",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Document restore smoke",
      status: "todo",
      priority: "medium",
      createdByUserId: "user-1",
    });

    const created = await svc.upsertIssueDocument({
      issueId,
      key: "plan",
      title: "Plan",
      format: "markdown",
      body: "# Plan\n\nRevision one.",
      createdByUserId: "user-1",
    });

    const updated = await svc.upsertIssueDocument({
      issueId,
      key: "plan",
      title: "Plan",
      format: "markdown",
      body: "# Plan\n\nRevision two.",
      baseRevisionId: created.document.latestRevisionId,
      createdByUserId: "user-1",
    });

    const restored = await svc.restoreIssueDocumentRevision({
      issueId,
      key: "plan",
      revisionId: created.document.latestRevisionId!,
      createdByUserId: "user-1",
    });

    const latest = await svc.getIssueDocumentByKey(issueId, "plan");
    const [documentRow] = await db
      .select({ latestBody: documents.latestBody })
      .from(documents)
      .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
      .where(eq(issueDocuments.issueId, issueId));

    expect(updated.document.latestRevisionNumber).toBe(2);
    expect(restored.document.body).toBe("# Plan\n\nRevision one.");
    expect("latestBody" in restored.document).toBe(false);
    expect(restored.document.latestRevisionNumber).toBe(3);
    expect(latest?.body).toBe("# Plan\n\nRevision one.");
    expect(documentRow?.latestBody).toBe("# Plan\n\nRevision one.");
  });
});
