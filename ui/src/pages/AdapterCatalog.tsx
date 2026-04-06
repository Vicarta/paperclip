import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cable, ChevronRight, Cpu, FileCode2, RadioTower } from "lucide-react";
import { Link } from "@/lib/router";
import { adaptersApi } from "@/api/adapters";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { queryKeys } from "@/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function runtimeKindLabel(kind: string) {
  if (kind === "gateway") return "Gateway";
  if (kind === "builtin") return "Builtin";
  return "Local CLI";
}

function RuntimeKindIcon({ kind }: { kind: string }) {
  if (kind === "gateway") return <RadioTower className="h-4 w-4 text-muted-foreground" />;
  if (kind === "builtin") return <FileCode2 className="h-4 w-4 text-muted-foreground" />;
  return <Cpu className="h-4 w-4 text-muted-foreground" />;
}

export function AdapterCatalogPage() {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Instance Settings" }, { label: "Adapters" }]);
  }, [setBreadcrumbs]);

  const adaptersQuery = useQuery({
    queryKey: queryKeys.adapters.all,
    queryFn: () => adaptersApi.list(),
  });

  if (adaptersQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading adapters...</div>;
  }

  if (adaptersQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {adaptersQuery.error instanceof Error ? adaptersQuery.error.message : "Failed to load adapters."}
      </div>
    );
  }

  const adapters = adaptersQuery.data ?? [];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Cable className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Adapters</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Catalog of installed agent runtimes. Agent-specific adapter settings still live on each agent page; this
          surface centralizes discovery, configuration references, and model-discovery diagnostics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {adapters.map((adapter) => (
          <Card key={adapter.type}>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{adapter.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{adapter.description}</p>
                </div>
                <Badge variant="outline">{runtimeKindLabel(adapter.runtimeKind)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={adapter.supportsModelDiscovery ? "default" : "secondary"}>
                  Models {adapter.supportsModelDiscovery ? "available" : "n/a"}
                </Badge>
                <Badge variant={adapter.supportsEnvironmentTest ? "default" : "secondary"}>
                  Env test {adapter.supportsEnvironmentTest ? "yes" : "no"}
                </Badge>
                <Badge variant={adapter.supportsIssueOverrides ? "default" : "secondary"}>
                  Issue overrides {adapter.supportsIssueOverrides ? "yes" : "no"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RuntimeKindIcon kind={adapter.runtimeKind} />
                <span className="font-mono">{adapter.type}</span>
                {adapter.supportsLocalAgentJwt ? <Badge variant="outline">Local JWT</Badge> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/instance/settings/adapters/${encodeURIComponent(adapter.type)}`}>
                    View details
                  </Link>
                </Button>
                {adapter.availableInAgentCreationUi ? (
                  <Button asChild size="sm">
                    <Link to={`/agents/new?adapterType=${encodeURIComponent(adapter.type)}`}>
                      Create agent
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
