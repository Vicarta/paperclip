// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { queryKeys } from "./lib/queryKeys";

const useQueryMock = vi.fn();
const openOnboardingMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("./context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [
      {
        id: "company-1",
        name: "Astrogen",
        issuePrefix: "AST",
        status: "active",
      },
    ],
    selectedCompanyId: "company-1",
    selectedCompany: {
      id: "company-1",
      name: "Astrogen",
      issuePrefix: "AST",
      status: "active",
    },
    selectionSource: "manual",
    loading: false,
    error: null,
    setSelectedCompanyId: vi.fn(),
    reloadCompanies: vi.fn(),
    createCompany: vi.fn(),
  }),
}));

vi.mock("./context/DialogContext", () => ({
  useDialog: () => ({
    onboardingOpen: false,
    openOnboarding: openOnboardingMock,
  }),
}));

vi.mock("./components/Layout", () => ({
  Layout: () => <div>layout</div>,
}));

vi.mock("./components/OnboardingWizard", () => ({
  OnboardingWizard: () => null,
}));

vi.mock("./pages/Dashboard", () => ({ Dashboard: () => <div>dashboard</div> }));
vi.mock("./pages/Companies", () => ({ Companies: () => <div>companies</div> }));
vi.mock("./pages/Agents", () => ({ Agents: () => <div>agents</div> }));
vi.mock("./pages/AgentDetail", () => ({ AgentDetail: () => <div>agent detail</div> }));
vi.mock("./pages/Projects", () => ({ Projects: () => <div>projects</div> }));
vi.mock("./pages/ProjectDetail", () => ({ ProjectDetail: () => <div>project detail</div> }));
vi.mock("./pages/Issues", () => ({ Issues: () => <div>issues</div> }));
vi.mock("./pages/IssueDetail", () => ({ IssueDetail: () => <div>issue detail</div> }));
vi.mock("./pages/Goals", () => ({ Goals: () => <div>goals</div> }));
vi.mock("./pages/GoalDetail", () => ({ GoalDetail: () => <div>goal detail</div> }));
vi.mock("./pages/Approvals", () => ({ Approvals: () => <div>approvals</div> }));
vi.mock("./pages/ApprovalDetail", () => ({ ApprovalDetail: () => <div>approval detail</div> }));
vi.mock("./pages/Costs", () => ({ Costs: () => <div>costs</div> }));
vi.mock("./pages/Activity", () => ({ Activity: () => <div>activity</div> }));
vi.mock("./pages/Inbox", () => ({ Inbox: () => <div>inbox</div> }));
vi.mock("./pages/MyIssues", () => ({ MyIssues: () => <div>my issues</div> }));
vi.mock("./pages/CompanySettings", () => ({ CompanySettings: () => <div>company settings</div> }));
vi.mock("./pages/DesignGuide", () => ({ DesignGuide: () => <div>design guide</div> }));
vi.mock("./pages/InstanceSettings", () => ({ InstanceSettings: () => <div>instance settings</div> }));
vi.mock("./pages/PluginManager", () => ({ PluginManager: () => <div>plugin manager</div> }));
vi.mock("./pages/PluginSettings", () => ({ PluginSettings: () => <div>plugin settings</div> }));
vi.mock("./pages/PluginPage", () => ({ PluginPage: () => <div>plugin page</div> }));
vi.mock("./pages/RunTranscriptUxLab", () => ({ RunTranscriptUxLab: () => <div>ux lab</div> }));
vi.mock("./pages/OrgChart", () => ({ OrgChart: () => <div>org</div> }));
vi.mock("./pages/NewAgent", () => ({ NewAgent: () => <div>new agent</div> }));
vi.mock("./pages/Auth", () => ({ AuthPage: () => <div>auth</div> }));
vi.mock("./pages/BoardClaim", () => ({ BoardClaimPage: () => <div>board claim</div> }));
vi.mock("./pages/InviteLanding", () => ({ InviteLandingPage: () => <div>invite landing</div> }));
vi.mock("./pages/NotFound", () => ({
  NotFoundPage: ({ scope }: { scope: string }) => <div>not found:{scope}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock("@/lib/router", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string | { pathname?: string } }) => {
      const target = typeof to === "string" ? to : (to.pathname ?? "");
      return <div data-testid="navigate-target">{target}</div>;
    },
  };
});

import { App } from "./App";

interface CapturedQueryOptions {
  queryKey: readonly unknown[];
}

describe("App my-issues route redirect", () => {
  beforeEach(() => {
    openOnboardingMock.mockReset();
    useQueryMock.mockReset();
    useQueryMock.mockImplementation((options) => {
      const query = options as CapturedQueryOptions;
      if (JSON.stringify(query.queryKey) === JSON.stringify(queryKeys.health)) {
        return {
          data: { status: "ok", deploymentMode: "local_trusted", bootstrapStatus: "ready" },
          isLoading: false,
          error: null,
        };
      }
      if (JSON.stringify(query.queryKey) === JSON.stringify(queryKeys.auth.session)) {
        return {
          data: null,
          isLoading: false,
          error: null,
        };
      }
      return { data: null, isLoading: false, error: null };
    });
  });

  it("redirects /my-issues to the selected company prefix instead of treating it as a company slug", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/my-issues"]}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain("/AST/my-issues");
    expect(html).not.toContain("not found:global");
  });
});
