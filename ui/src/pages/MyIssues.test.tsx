// @vitest-environment node

import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Issue } from "@paperclipai/shared";
import { queryKeys } from "../lib/queryKeys";

const listMock = vi.fn();
const useQueryMock = vi.fn();
const setBreadcrumbsMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("../api/issues", () => ({
  issuesApi: {
    list: (...args: unknown[]) => listMock(...args),
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
    useQueryMock.mockReset();
    setBreadcrumbsMock.mockClear();
  });

  it("queries only issues assigned to the current user", async () => {
    const captured = { current: null as CapturedQueryOptions | null };

    listMock.mockResolvedValue([]);
    useQueryMock.mockImplementation((options) => {
      captured.current = options as CapturedQueryOptions;
      return { data: [], isLoading: false, error: null };
    });

    renderToStaticMarkup(<MyIssues />);

    if (!captured.current) {
      throw new Error("Expected MyIssues to register a React Query config");
    }
    const options = captured.current;

    expect(options.queryKey).toEqual(queryKeys.issues.listAssignedToMe("company-1"));
    expect(options.enabled).toBe(true);

    await options.queryFn();

    expect(listMock).toHaveBeenCalledWith("company-1", {
      assigneeUserId: "me",
      status: "backlog,todo,in_progress,in_review,blocked",
    });
  });

  it("renders an empty state when there are no assigned issues", () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false, error: null });

    const html = renderToStaticMarkup(<MyIssues />);

    expect(html).toContain("No issues assigned to you.");
  });

  it("renders only the server-returned assigned issues", () => {
    const issues: Issue[] = [
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

    useQueryMock.mockReturnValue({ data: issues, isLoading: false, error: null });

    const html = renderToStaticMarkup(<MyIssues />);

    expect(html).toContain("Review returned plan");
    expect(html).not.toContain("No issues assigned to you.");
  });
});
