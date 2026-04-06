import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cable, ChevronLeft, Cpu, PlayCircle } from "lucide-react";
import { Link, Navigate, useParams } from "@/lib/router";
import { adaptersApi } from "@/api/adapters";
import { agentsApi } from "@/api/agents";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownBody } from "@/components/MarkdownBody";
import { agentUrl } from "@/lib/utils";

function runtimeKindLabel(kind: string) {
  if (kind === "gateway") return "Gateway";
  if (kind === "builtin") return "Builtin";
  return "Local CLI";
}

export function AdapterDetailPage() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompanyId } = useCompany();
  const { adapterType } = useParams<{ adapterType: string }>();
  const type = adapterType ?? "";

  const detailQuery = useQuery({
    queryKey: queryKeys.adapters.detail(type),
    queryFn: () => adaptersApi.get(type),
    enabled: type.length > 0,
  });

  const agentsQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.agents.list(selectedCompanyId) : ["agents", "none"],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const modelsQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.agents.adapterModels(selectedCompanyId, type) : ["agents", "none", type],
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, type),
    enabled: Boolean(selectedCompanyId) && type.length > 0,
  });

  useEffect(() => {
    const label = detailQuery.data?.label ?? "Adapter";
    setBreadcrumbs([{ label: "Instance Settings" }, { label: "Adapters", href: "/instance/settings/adapters" }, { label }]);
  }, [detailQuery.data?.label, setBreadcrumbs]);

  const adapter = detailQuery.data;
  const agentsUsingAdapter = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => agent.adapterType === type),
    [agentsQuery.data, type],
  );

  if (detailQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading adapter details...</div>;
  }

  if (!adapter) {
    return <Navigate to="/instance/settings/adapters" replace />;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link to="/instance/settings/adapters" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Back to adapters
          </Link>
          <div className="flex items-center gap-2">
            <Cable className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{adapter.label}</h1>
            <Badge variant="outline">{runtimeKindLabel(adapter.runtimeKind)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{adapter.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={adapter.supportsModelDiscovery ? "default" : "secondary"}>
              Models {adapter.supportsModelDiscovery ? "available" : "n/a"}
            </Badge>
            <Badge variant={adapter.supportsEnvironmentTest ? "default" : "secondary"}>
              Environment test {adapter.supportsEnvironmentTest ? "yes" : "no"}
            </Badge>
            <Badge variant={adapter.supportsIssueOverrides ? "default" : "secondary"}>
              Issue overrides {adapter.supportsIssueOverrides ? "yes" : "no"}
            </Badge>
            {adapter.supportsLocalAgentJwt ? <Badge variant="outline">Local JWT</Badge> : null}
          </div>
        </div>
        {adapter.availableInAgentCreationUi ? (
          <Button asChild>
            <Link to={`/agents/new?adapterType=${encodeURIComponent(adapter.type)}`}>Create agent</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration Reference</CardTitle>
              <CardDescription>
                Canonical adapter contract surfaced from the server registry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MarkdownBody className="text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                {adapter.configurationDoc}
              </MarkdownBody>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to use it</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Agent-specific adapter settings are edited on each agent page. This instance-level view exists so you
                can discover available runtimes, read their configuration contract, and inspect model discovery in the
                currently selected company.
              </p>
              <p className="font-mono text-xs text-foreground">{adapter.type}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Model Discovery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedCompanyId ? (
                <p className="text-sm text-muted-foreground">Select a company to inspect adapter model discovery.</p>
              ) : modelsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading models...</p>
              ) : modelsQuery.error ? (
                <p className="text-sm text-destructive">
                  {modelsQuery.error instanceof Error ? modelsQuery.error.message : "Failed to load models."}
                </p>
              ) : (modelsQuery.data ?? []).length > 0 ? (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {(modelsQuery.data ?? []).map((model) => (
                    <div key={model.id} className="rounded px-2 py-1 text-xs hover:bg-accent/30">
                      {model.id}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No models discovered for the selected company. If this adapter requires provider auth, verify its
                  environment secrets before testing agents with it.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                Agents Using This Adapter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentsUsingAdapter.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents in the selected company are using this adapter yet.</p>
              ) : (
                <div className="space-y-2">
                  {agentsUsingAdapter.map((agent) => (
                    <Link
                      key={agent.id}
                      to={agentUrl(agent)}
                      className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/30"
                    >
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">{agent.title ?? agent.role}</div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
