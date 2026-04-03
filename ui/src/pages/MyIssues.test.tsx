// @vitest-environment node

import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Issue, IssueLabel } from "@paperclipai/shared";
import { queryKeys } from "../lib/queryKeys";
import {
  HUMAN_DECISION_NEEDED_LABEL_NAME,
  MY_ISSUE_ACTIVE_STATUSES,
} from "../lib/myIssues";

const listMock = vi.fn();
const listLabelsMock = vi.fn();
const useQueryMock = vi.fn();
const setBreadcrumbsMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("../api/issues", () => ({
  issuesApi: {
    list: (...args: unknown[]) => listMock(...args),
    listLabels: (...args: unknown[]) => listLabelsMock(...args),
  },
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
  }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({
    setBreadcrumbs: setBreadcrumbsMock,
  }),
}));

vi.mock("../components/StatusIcon", () => ({
  StatusIcon: () => <span data-testid="status-icon" />,
}));

vi.mock("../components/PriorityIcon", () => ({
  PriorityIcon: () => <span data-testid="priority-icon" />,
}));

vi.mock("../components/EntityRow", () => ({
  EntityRow: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("../components/EmptyState", () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("../components/PageSkeleton", () => ({
  PageSkeleton: () => <div>loading</div>,
}));

import { MyIssues } from "./MyIssues";

interface CapturedQueryOptions {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
}

describe("MyIssues", () => {
  beforeEach(() => {
    listMock.mockReset();
    listLabelsMock.mockReset();
    useQueryMock.mockReset();
    setBreadcrumbsMock.mockClear();
  });

  it("does not query the Human Decision Needed lane when the label is absent", async () => {
    const capturedQueries: CapturedQueryOptions[] = [];

    listMock.mockResolvedValue([]);
    listLabelsMock.mockResolvedValue([]);
    useQueryMock.mockImplementation((options) => {
      capturedQueries.push(options as CapturedQueryOptions);
      return { data: [], isLoading: false, error: null };
    });

    renderToStaticMarkup(<MyIssues />);

    const humanDecisionQuery = capturedQueries.find(
      (query) =>
        JSON.stringify(query.queryKey) ===
        JSON.stringify(queryKeys.issues.listHumanDecisionNeededForMe("company-1", "__missing__")),
    );

    expect(humanDecisionQuery?.enabled).toBe(false);
  });

  it("queries labels, assigned issues, and touched Human Decision Needed issues", async () => {
    const capturedQueries: CapturedQueryOptions[] = [];
    const labels: IssueLabel[] = [
      {
        id: "label-1",
        companyId: "company-1",
        name: HUMAN_DECISION_NEEDED_LABEL_NAME,
        color: "#f00",
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      },
    ];

    listLabelsMock.mockResolvedValue(labels);
    listMock.mockResolvedValue([]);
    useQueryMock.mockImplementation((options) => {
      capturedQueries.push(options as CapturedQueryOptions);
      const key = JSON.stringify((options as CapturedQueryOptions).queryKey);
      if (key === JSON.stringify(queryKeys.issues.labels("company-1"))) {
        return { data: labels, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    renderToStaticMarkup(<MyIssues />);

    const assignedQuery = capturedQueries.find(
      (query) =>
        JSON.stringify(query.queryKey) ===
        JSON.stringify(queryKeys.issues.listAssignedToMe("company-1")),
    );
    const humanDecisionQuery = capturedQueries.find(
      (query) =>
        JSON.stringify(query.queryKey) ===
        JSON.stringify(queryKeys.issues.listHumanDecisionNeededForMe("company-1", "label-1")),
    );

    expect(assignedQuery).toBeTruthy();
    expect(humanDecisionQuery).toBeTruthy();

    await assignedQuery?.queryFn();
    expect(listMock).toHaveBeenCalledWith("company-1", {
      assigneeUserId: "me",
      status: MY_ISSUE_ACTIVE_STATUSES,
    });

    await humanDecisionQuery?.queryFn();
    expect(listMock).toHaveBeenCalledWith("company-1", {
      touchedByUserId: "me",
      labelId: "label-1",
      status: MY_ISSUE_ACTIVE_STATUSES,
    });
  });

  it("renders an empty state when there are no assigned issues", () => {
    useQueryMock.mockImplementation((options) => {
      const key = JSON.stringify((options as CapturedQueryOptions).queryKey);
      if (key === JSON.stringify(queryKeys.issues.labels("company-1"))) {
        return { data: [], isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const html = renderToStaticMarkup(<MyIssues />);

    expect(html).toContain("No active issues require your attention.");
  });

  it("renders the merged issue set without duplicates", () => {
    const assignedIssues: Issue[] = [
      {
        id: "issue-1",
        companyId: "company-1",
        title: "Review returned plan",
        description: "",
        status: "in_review",
        priority: "medium",
        assigneeAgentId: null,
        assigneeUserId: "user-1",
        projectId: null,
        goalId: null,
        parentId: null,
        checkoutRunId: null,
        executionRunId: null,
        executionAgentNameKey: null,
        executionLockedAt: null,
        createdByAgentId: null,
        createdByUserId: "user-1",
        issueNumber: 42,
        identifier: "PAP-42",
        requestDepth: 0,
        billingCode: null,
        assigneeAdapterOverrides: null,
        executionWorkspaceSettings: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        hiddenAt: null,
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      },
    ];
    const humanDecisionIssues: Issue[] = [
      assignedIssues[0],
      {
        id: "issue-2",
        companyId: "company-1",
        title: "Resolve human decision blocker",
        description: "",
        status: "blocked",
        priority: "high",
        assigneeAgentId: "agent-1",
        assigneeUserId: null,
        projectId: null,
        goalId: null,
        parentId: null,
        checkoutRunId: null,
        executionRunId: null,
        executionAgentNameKey: null,
        executionLockedAt: null,
        createdByAgentId: null,
        createdByUserId: "user-1",
        issueNumber: 43,
        identifier: "PAP-43",
        requestDepth: 0,
        billingCode: null,
        assigneeAdapterOverrides: null,
        executionWorkspaceSettings: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        hiddenAt: null,
        createdAt: new Date("2026-03-26T13:00:00.000Z"),
        updatedAt: new Date("2026-03-26T13:00:00.000Z"),
      },
    ];
    const labels: IssueLabel[] = [
      {
        id: "label-1",
        companyId: "company-1",
        name: HUMAN_DECISION_NEEDED_LABEL_NAME,
        color: "#f00",
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      },
    ];

    useQueryMock.mockImplementation((options) => {
      const key = JSON.stringify((options as CapturedQueryOptions).queryKey);
      if (key === JSON.stringify(queryKeys.issues.labels("company-1"))) {
        return { data: labels, isLoading: false, error: null };
      }
      if (key === JSON.stringify(queryKeys.issues.listAssignedToMe("company-1"))) {
        return { data: assignedIssues, isLoading: false, error: null };
      }
      if (key === JSON.stringify(queryKeys.issues.listHumanDecisionNeededForMe("company-1", "label-1"))) {
        return { data: humanDecisionIssues, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const html = renderToStaticMarkup(<MyIssues />);

    expect(html).toContain("Review returned plan");
    expect(html).toContain("Resolve human decision blocker");
    expect(html.match(/Review returned plan/g)?.length).toBe(1);
    expect(html).not.toContain("No active issues require your attention.");
  });
});
