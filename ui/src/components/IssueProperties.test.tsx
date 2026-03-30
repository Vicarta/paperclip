// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Issue } from "@paperclipai/shared";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const useQueryClientMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
  useMutation: (options: unknown) => useMutationMock(options),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("../api/agents", () => ({
  agentsApi: {
    list: vi.fn(),
  },
}));

vi.mock("../api/auth", () => ({
  authApi: {
    getSession: vi.fn(),
  },
}));

vi.mock("../api/issues", () => ({
  issuesApi: {
    listLabels: vi.fn(),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
  },
}));

vi.mock("../api/projects", () => ({
  projectsApi: {
    list: vi.fn(),
  },
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
  }),
}));

vi.mock("../hooks/useProjectOrder", () => ({
  useProjectOrder: ({ projects }: { projects: unknown[] }) => ({
    orderedProjects: projects,
  }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
  } & Record<string, unknown>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./StatusIcon", () => ({
  StatusIcon: () => <span>Status</span>,
}));

vi.mock("./PriorityIcon", () => ({
  PriorityIcon: () => <span>Priority</span>,
}));

vi.mock("./Identity", () => ({
  Identity: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("./AgentIconPicker", () => ({
  AgentIcon: () => <span>AgentIcon</span>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { IssueProperties } from "./IssueProperties";

describe("IssueProperties timestamps", () => {
  beforeEach(() => {
    process.env.TZ = "UTC";
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useQueryClientMock.mockReset();

    useQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    useMutationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    useQueryClientMock.mockReturnValue({
      invalidateQueries: vi.fn(),
    });
  });

  it("renders absolute timestamps for started/completed/created and relative+absolute for updated", () => {
    const issue = {
      id: "issue-1",
      companyId: "company-1",
      projectId: null,
      goalId: null,
      parentId: null,
      title: "Test issue",
      description: null,
      status: "todo",
      priority: "medium",
      assigneeAgentId: null,
      assigneeUserId: null,
      checkoutRunId: null,
      executionRunId: null,
      executionAgentNameKey: null,
      executionLockedAt: null,
      createdByAgentId: null,
      createdByUserId: "user-1",
      issueNumber: 1,
      identifier: "AST-1",
      requestDepth: 0,
      billingCode: null,
      assigneeAdapterOverrides: null,
      executionWorkspaceSettings: null,
      startedAt: new Date("2026-03-30T17:45:00.000Z"),
      completedAt: new Date("2026-03-30T18:05:00.000Z"),
      cancelledAt: null,
      hiddenAt: null,
      labelIds: [],
      labels: [],
      createdAt: new Date("2026-03-30T17:30:00.000Z"),
      updatedAt: new Date(Date.now() - 54 * 60 * 1000),
    } as Issue;

    const html = renderToStaticMarkup(
      <IssueProperties issue={issue} onUpdate={vi.fn()} />
    );

    expect(html).toContain("Mar 30, 2026, 5:45 PM");
    expect(html).toContain("Mar 30, 2026, 6:05 PM");
    expect(html).toContain("Mar 30, 2026, 5:30 PM");
    expect(html).toMatch(/54m ago|53m ago|55m ago/);
    expect(html).toContain(formatUpdatedAt(issue.updatedAt));
  });
});

function formatUpdatedAt(value: Date): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
