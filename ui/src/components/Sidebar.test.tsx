// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { queryKeys } from "../lib/queryKeys";
import {
  HUMAN_DECISION_NEEDED_LABEL_NAME,
  MY_ISSUE_ACTIVE_STATUSES,
} from "../lib/myIssues";

const useQueryMock = vi.fn();
const issuesListMock = vi.fn();
const listLabelsMock = vi.fn();
const liveRunsMock = vi.fn();
const useInboxBadgeMock = vi.fn();
const sidebarNavItemMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("../api/issues", () => ({
  issuesApi: {
    list: (...args: unknown[]) => issuesListMock(...args),
    listLabels: (...args: unknown[]) => listLabelsMock(...args),
  },
}));

vi.mock("../api/heartbeats", () => ({
  heartbeatsApi: {
    liveRunsForCompany: (...args: unknown[]) => liveRunsMock(...args),
  },
}));

vi.mock("../context/DialogContext", () => ({
  useDialog: () => ({
    openNewIssue: vi.fn(),
  }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    selectedCompany: {
      id: "company-1",
      name: "Acme",
      issuePrefix: "ACM",
      brandColor: "#00ff00",
    },
  }),
}));

vi.mock("../hooks/useInboxBadge", () => ({
  useInboxBadge: (...args: unknown[]) => useInboxBadgeMock(...args),
}));

vi.mock("./SidebarSection", () => ({
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./SidebarProjects", () => ({
  SidebarProjects: () => <div>projects</div>,
}));

vi.mock("./SidebarAgents", () => ({
  SidebarAgents: () => <div>agents</div>,
}));

vi.mock("./SidebarNavItem", () => ({
  SidebarNavItem: (props: unknown) => {
    sidebarNavItemMock(props);
    return <div />;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock("@/plugins/slots", () => ({
  PluginSlotOutlet: () => null,
}));

import { Sidebar } from "./Sidebar";

interface CapturedQueryOptions {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
}

describe("Sidebar My Issues badge", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    issuesListMock.mockReset();
    listLabelsMock.mockReset();
    liveRunsMock.mockReset();
    useInboxBadgeMock.mockReset();
    sidebarNavItemMock.mockReset();
    useInboxBadgeMock.mockReturnValue({ inbox: 0, approvals: 0, failedRuns: 0, joinRequests: 0 });
  });

  it("queries the merged My Issues sources and shows the deduped count", async () => {
    const capturedQueries: CapturedQueryOptions[] = [];
    const labels = [
      { id: "label-1", companyId: "company-1", name: HUMAN_DECISION_NEEDED_LABEL_NAME, color: "#f00" },
    ];

    listLabelsMock.mockResolvedValue(labels);
    issuesListMock.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    liveRunsMock.mockResolvedValue([]);
    useQueryMock.mockImplementation((options) => {
      capturedQueries.push(options as CapturedQueryOptions);
      const key = (options as CapturedQueryOptions).queryKey;
      if (JSON.stringify(key) === JSON.stringify(queryKeys.issues.listAssignedToMe("company-1"))) {
        return { data: [{ id: "1" }, { id: "2" }], isLoading: false, error: null };
      }
      if (JSON.stringify(key) === JSON.stringify(queryKeys.issues.labels("company-1"))) {
        return { data: labels, isLoading: false, error: null };
      }
      if (
        JSON.stringify(key) ===
        JSON.stringify(queryKeys.issues.listHumanDecisionNeededForMe("company-1", "label-1"))
      ) {
        return { data: [{ id: "2" }, { id: "3" }], isLoading: false, error: null };
      }
      if (JSON.stringify(key) === JSON.stringify(queryKeys.liveRuns("company-1"))) {
        return { data: [], isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    renderToStaticMarkup(<Sidebar />);

    const assignedToMeQuery = capturedQueries.find(
      (query) =>
        JSON.stringify(query.queryKey) ===
        JSON.stringify(queryKeys.issues.listAssignedToMe("company-1")),
    );

    expect(assignedToMeQuery).toBeTruthy();
    await assignedToMeQuery?.queryFn();
    expect(issuesListMock).toHaveBeenCalledWith("company-1", {
      assigneeUserId: "me",
      status: MY_ISSUE_ACTIVE_STATUSES,
    });

    const humanDecisionQuery = capturedQueries.find(
      (query) =>
        JSON.stringify(query.queryKey) ===
        JSON.stringify(queryKeys.issues.listHumanDecisionNeededForMe("company-1", "label-1")),
    );

    expect(humanDecisionQuery).toBeTruthy();
    await humanDecisionQuery?.queryFn();
    expect(issuesListMock).toHaveBeenCalledWith("company-1", {
      touchedByUserId: "me",
      labelId: "label-1",
      status: MY_ISSUE_ACTIVE_STATUSES,
    });

    const myIssuesNavCall = sidebarNavItemMock.mock.calls
      .map(([props]) => props)
      .find((props) => (props as { label?: string }).label === "My Issues") as
      | { badge?: number }
      | undefined;

    expect(myIssuesNavCall?.badge).toBe(3);
  });
});
