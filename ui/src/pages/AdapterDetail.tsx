import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, ChevronLeft, Cpu, PlayCircle } from "lucide-react";
import { Link, Navigate, useParams } from "@/lib/router";
import { adaptersApi } from "@/api/adapters";
import { agentsApi } from "@/api/agents";
import { secretsApi } from "@/api/secrets";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownBody } from "@/components/MarkdownBody";
import { agentUrl } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function runtimeKindLabel(kind: string) {
  if (kind === "remote_api") return "Remote API";
  if (kind === "gateway") return "Gateway";
  if (kind === "builtin") return "Builtin";
  return "Local CLI";
}

function isOpenRouterAdapter(type: string) {
  return type === "openrouter" || type === "openrouter_local";
}

function parseConfiguredSecretId(settingsJson: Record<string, unknown> | undefined): string {
  const env = settingsJson?.env;
  if (!env || typeof env !== "object" || Array.isArray(env)) return "";
  const binding = (env as Record<string, unknown>).OPENROUTER_API_KEY;
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) return "";
  const secretId = (binding as Record<string, unknown>).secretId;
  return typeof secretId === "string" ? secretId : "";
}

export function AdapterDetailPage() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { adapterType } = useParams<{ adapterType: string }>();
  const type = adapterType ?? "";
  const [openRouterSecretId, setOpenRouterSecretId] = useState("");
  const [openRouterRawKey, setOpenRouterRawKey] = useState("");
  const [openRouterSecretName, setOpenRouterSecretName] = useState("OpenRouter API Key");
  const [settingsError, setSettingsError] = useState<string | null>(null);

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

  const adapterSettingsQuery = useQuery({
    queryKey: selectedCompanyId ? ["adapter-settings", selectedCompanyId, type] : ["adapter-settings", "none", type],
    queryFn: () => adaptersApi.getSettings(selectedCompanyId!, type),
    enabled: Boolean(selectedCompanyId) && isOpenRouterAdapter(type),
  });

  const secretsQuery = useQuery({
    queryKey: selectedCompanyId ? ["company-secrets", selectedCompanyId] : ["company-secrets", "none"],
    queryFn: () => secretsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId) && isOpenRouterAdapter(type),
  });

  useEffect(() => {
    if (!isOpenRouterAdapter(type)) return;
    const configuredSecretId = parseConfiguredSecretId(adapterSettingsQuery.data?.settingsJson);
    if (configuredSecretId) setOpenRouterSecretId(configuredSecretId);
  }, [adapterSettingsQuery.data?.settingsJson, type]);

  useEffect(() => {
    const label = detailQuery.data?.label ?? "Adapter";
    setBreadcrumbs([{ label: "Instance Settings" }, { label: "Adapters", href: "/instance/settings/adapters" }, { label }]);
  }, [detailQuery.data?.label, setBreadcrumbs]);

  const adapter = detailQuery.data;
  const agentsUsingAdapter = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => agent.adapterType === type),
    [agentsQuery.data, type],
  );

  const saveOpenRouterSettings = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("Select a company first.");
      let secretId = openRouterSecretId.trim();
      const newKey = openRouterRawKey.trim();

      if (newKey) {
        if (secretId) {
          await secretsApi.rotate(secretId, { value: newKey });
        } else {
          const created = await secretsApi.create(selectedCompanyId, {
            name: openRouterSecretName.trim() || "OpenRouter API Key",
            value: newKey,
            description: "API key for OpenRouter via OpenCode adapter settings",
          });
          secretId = created.id;
        }
      }

      if (!secretId) {
        throw new Error("Choose an existing secret or paste a new OpenRouter API key.");
      }

      return adaptersApi.saveSettings(selectedCompanyId, type, {
        env: {
          OPENROUTER_API_KEY: {
            type: "secret_ref",
            secretId,
            version: "latest",
          },
        },
      });
    },
    onSuccess: async () => {
      setOpenRouterRawKey("");
      setSettingsError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adapter-settings", selectedCompanyId, type] }),
        queryClient.invalidateQueries({ queryKey: ["company-secrets", selectedCompanyId] }),
        queryClient.invalidateQueries({ queryKey: selectedCompanyId ? queryKeys.agents.adapterModels(selectedCompanyId, type) : ["agents", "none", type] }),
      ]);
    },
    onError: (error) => {
      setSettingsError(error instanceof Error ? error.message : "Failed to save adapter settings.");
    },
  });

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
              {type === "openrouter" ? (
                <p>
                  This is the direct external OpenRouter runtime. Requests go from Paperclip to the OpenRouter HTTP API.
                  No local CLI is required on the host.
                </p>
              ) : null}
              {type === "openrouter_local" ? (
                <p>
                  This specific adapter is a local OpenCode runtime preset. It still requires OpenCode CLI on the
                  Paperclip host. The company-level settings below only centralize OpenRouter provider auth; they do
                  not convert it into a direct HTTP runtime.
                </p>
              ) : null}
              <p className="font-mono text-xs text-foreground">{adapter.type}</p>
            </CardContent>
          </Card>

          {isOpenRouterAdapter(type) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Settings</CardTitle>
                <CardDescription>
                  Centralize <span className="font-mono">OPENROUTER_API_KEY</span> for all agents using this adapter in
                  the selected company.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">Select a company to configure provider authentication.</p>
                ) : secretsQuery.isLoading || adapterSettingsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading settings…</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="openrouter-secret-select">Existing secret</Label>
                      <select
                        id="openrouter-secret-select"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={openRouterSecretId}
                        onChange={(e) => setOpenRouterSecretId(e.target.value)}
                      >
                        <option value="">Select secret…</option>
                        {(secretsQuery.data ?? []).map((secret) => (
                          <option key={secret.id} value={secret.id}>
                            {secret.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Current binding: {parseConfiguredSecretId(adapterSettingsQuery.data?.settingsJson) ? "configured" : "not configured"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="openrouter-secret-name">New secret name</Label>
                      <Input
                        id="openrouter-secret-name"
                        value={openRouterSecretName}
                        onChange={(e) => setOpenRouterSecretName(e.target.value)}
                        placeholder="OpenRouter API Key"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="openrouter-raw-key">Paste new API key</Label>
                      <Input
                        id="openrouter-raw-key"
                        type="password"
                        value={openRouterRawKey}
                        onChange={(e) => setOpenRouterRawKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                      />
                      <p className="text-xs text-muted-foreground">
                        If you paste a new value and select an existing secret, Paperclip will rotate that secret. If no
                        secret is selected, Paperclip will create one.
                      </p>
                    </div>

                    {settingsError ? <p className="text-sm text-destructive">{settingsError}</p> : null}

                    <Button
                      onClick={() => saveOpenRouterSettings.mutate()}
                      disabled={saveOpenRouterSettings.isPending}
                    >
                      {saveOpenRouterSettings.isPending ? "Saving…" : "Save OpenRouter settings"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

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
