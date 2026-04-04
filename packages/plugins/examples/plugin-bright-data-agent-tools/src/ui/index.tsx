import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import {
  DEFAULT_BRIGHT_DATA_GROUPS,
  DEFAULT_BRIGHT_DATA_MCP_URL,
} from "../constants.js";

type PluginConfig = {
  brightDataTokenSecretRef?: string;
  brightDataMcpUrl?: string;
  brightDataGroups?: string[];
  flatCostCentsPerInvocation?: number;
};

type CompanySecret = {
  id: string;
  name: string;
  description?: string | null;
  updatedAt?: string;
};

type SaveState = {
  tone: "success" | "error";
  message: string;
} | null;

const stackStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "16px",
  background: "var(--card, transparent)",
};

const labelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  marginBottom: "6px",
  display: "block",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "10px 12px",
  background: "transparent",
  color: "inherit",
  fontSize: "13px",
};

const buttonStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid var(--border)",
  borderRadius: "999px",
  background: "transparent",
  color: "inherit",
  padding: "8px 14px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "var(--foreground)",
  color: "var(--background)",
  borderColor: "var(--foreground)",
};

function readPluginIdFromLocation() {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }
  return await response.json() as T;
}

function formatSecretStatus(secret: CompanySecret | undefined) {
  if (!secret) return "Configured";
  return `Configured via secret: ${secret.name}`;
}

export function BrightDataSettingsPage({ context }: PluginSettingsPageProps) {
  const pluginId = useMemo(() => readPluginIdFromLocation(), []);
  const companyId = context.companyId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveState>(null);
  const [config, setConfig] = useState<PluginConfig>({});
  const [secrets, setSecrets] = useState<CompanySecret[]>([]);
  const [brightDataMcpUrl, setBrightDataMcpUrl] = useState(DEFAULT_BRIGHT_DATA_MCP_URL);
  const [groupText, setGroupText] = useState(DEFAULT_BRIGHT_DATA_GROUPS.join(", "));
  const [flatCostCentsPerInvocation, setFlatCostCentsPerInvocation] = useState("0");
  const [replaceToken, setReplaceToken] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!pluginId || !companyId) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const [configResponse, secretsResponse] = await Promise.all([
          api<{ configJson: Record<string, unknown> }>(`/plugins/${pluginId}/config`),
          api<CompanySecret[]>(`/companies/${companyId}/secrets`),
        ]);

        if (cancelled) return;
        const nextConfig = (configResponse.configJson ?? {}) as PluginConfig;
        setConfig(nextConfig);
        setSecrets(secretsResponse);
        setBrightDataMcpUrl(
          typeof nextConfig.brightDataMcpUrl === "string" && nextConfig.brightDataMcpUrl.trim().length > 0
            ? nextConfig.brightDataMcpUrl
            : DEFAULT_BRIGHT_DATA_MCP_URL,
        );
        setGroupText(
          Array.isArray(nextConfig.brightDataGroups) && nextConfig.brightDataGroups.length > 0
            ? nextConfig.brightDataGroups.join(", ")
            : DEFAULT_BRIGHT_DATA_GROUPS.join(", "),
        );
        setFlatCostCentsPerInvocation(
          String(
            typeof nextConfig.flatCostCentsPerInvocation === "number" &&
              Number.isFinite(nextConfig.flatCostCentsPerInvocation)
              ? nextConfig.flatCostCentsPerInvocation
              : 0,
          ),
        );
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load Bright Data plugin settings.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, pluginId]);

  const currentSecret = secrets.find(
    (secret: CompanySecret) => secret.id === config.brightDataTokenSecretRef,
  );

  async function handleSave() {
    if (!companyId || !pluginId) return;
    setSaving(true);
    setMessage(null);

    try {
      let secretId = config.brightDataTokenSecretRef ?? "";
      const trimmedToken = token.trim();
      const groups = groupText
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      const numericFlatCost = Number.parseFloat(flatCostCentsPerInvocation);

      if (trimmedToken.length > 0) {
        if (secretId) {
          await api(`/secrets/${secretId}/rotate`, {
            method: "POST",
            body: JSON.stringify({ value: trimmedToken }),
          });
        } else {
          const created = await api<CompanySecret>(`/companies/${companyId}/secrets`, {
            method: "POST",
            body: JSON.stringify({
              name: "Bright Data API Token",
              description: "API token used by the Bright Data Agent Tools plugin.",
              value: trimmedToken,
            }),
          });
          secretId = created.id;
        }
      }

      const nextConfig: PluginConfig = {
        brightDataMcpUrl: brightDataMcpUrl.trim() || DEFAULT_BRIGHT_DATA_MCP_URL,
        brightDataTokenSecretRef: secretId || "",
        brightDataGroups: groups.length > 0 ? groups : [...DEFAULT_BRIGHT_DATA_GROUPS],
        flatCostCentsPerInvocation:
          Number.isFinite(numericFlatCost) && numericFlatCost >= 0
            ? numericFlatCost
            : 0,
      };

      await api(`/plugins/${pluginId}/config`, {
        method: "POST",
        body: JSON.stringify(nextConfig),
      });

      const nextSecrets = companyId
        ? await api<CompanySecret[]>(`/companies/${companyId}/secrets`)
        : [];

      setConfig(nextConfig);
      setSecrets(nextSecrets);
      setToken("");
      setReplaceToken(false);
      setMessage({ tone: "success", message: "Bright Data plugin settings saved." });
    } catch (error) {
      setMessage({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save Bright Data plugin settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return <div style={cardStyle}>Select a company to configure the Bright Data plugin.</div>;
  }

  if (loading) {
    return <div style={cardStyle}>Loading Bright Data plugin settings…</div>;
  }

  return (
    <div style={stackStyle}>
      <div style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Bright Data MCP URL</label>
            <input
              style={inputStyle}
              value={brightDataMcpUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBrightDataMcpUrl(event.target.value)}
              placeholder={DEFAULT_BRIGHT_DATA_MCP_URL}
            />
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Defaults to the official Bright Data remote MCP endpoint.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Bright Data groups</label>
            <input
              style={inputStyle}
              value={groupText}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setGroupText(event.target.value)}
              placeholder={DEFAULT_BRIGHT_DATA_GROUPS.join(", ")}
            />
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Comma-separated allowlist. Keep this scope narrow and social-first.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Flat Cost Per Invocation (cents)</label>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={flatCostCentsPerInvocation}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setFlatCostCentsPerInvocation(event.target.value)
              }
              placeholder="0"
            />
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Optional operator-maintained marginal cost used for provider cost attribution in the Costs view.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Bright Data API Token</label>
            {config.brightDataTokenSecretRef && !replaceToken ? (
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "13px",
                  background: "color-mix(in srgb, var(--muted, #888) 14%, transparent)",
                }}>
                  {formatSecretStatus(currentSecret)}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button style={buttonStyle} onClick={() => setReplaceToken(true)} disabled={saving}>
                    Replace token
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                <input
                  style={inputStyle}
                  type="password"
                  value={token}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setToken(event.target.value)}
                  placeholder={config.brightDataTokenSecretRef ? "Enter a new Bright Data token" : "Enter Bright Data token"}
                />
                <p style={{ marginTop: 0, fontSize: "12px", color: "var(--muted-foreground)" }}>
                  The plaintext token is stored once in Company Secrets. Plugin config keeps only the secret reference.
                </p>
              </div>
            )}
          </div>

          {message ? (
            <div style={{
              borderRadius: "10px",
              border: `1px solid ${message.tone === "success" ? "color-mix(in srgb, green 45%, var(--border))" : "color-mix(in srgb, red 45%, var(--border))"}`,
              padding: "10px 12px",
              fontSize: "13px",
            }}>
              {message.message}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button style={primaryButtonStyle} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
            <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
              This plugin is for server-side Bright Data MCP access only. Never expose the token in client code.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
