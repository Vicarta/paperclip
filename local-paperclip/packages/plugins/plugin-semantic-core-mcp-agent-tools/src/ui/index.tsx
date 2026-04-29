import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { DEFAULT_SEMANTIC_CORE_MCP_URL } from "../constants.js";

type PluginConfig = {
  semanticCoreMcpTokenSecretRef?: string;
  semanticCoreMcpUrl?: string;
  allowedProjectIdsCsv?: string;
  allowedClientKeysCsv?: string;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  runWaitTimeoutMs?: number;
};

type CompanySecret = {
  id: string;
  name: string;
  description?: string | null;
};

type SaveState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

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
  return (await response.json()) as T;
}

function readPositiveNumber(value: string, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function formatSecretStatus(secret: CompanySecret | undefined) {
  if (!secret) return "Configured";
  return `Configured via secret: ${secret.name}`;
}

export function SemanticCoreMcpSettingsPage({ context }: PluginSettingsPageProps) {
  const pluginId = useMemo(() => readPluginIdFromLocation(), []);
  const companyId = context.companyId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveState>(null);
  const [config, setConfig] = useState<PluginConfig>({});
  const [secrets, setSecrets] = useState<CompanySecret[]>([]);
  const [mcpUrl, setMcpUrl] = useState(DEFAULT_SEMANTIC_CORE_MCP_URL);
  const [allowedProjectIdsCsv, setAllowedProjectIdsCsv] = useState("");
  const [allowedClientKeysCsv, setAllowedClientKeysCsv] = useState("");
  const [requestTimeoutMs, setRequestTimeoutMs] = useState("180000");
  const [pollIntervalMs, setPollIntervalMs] = useState("2000");
  const [runWaitTimeoutMs, setRunWaitTimeoutMs] = useState("600000");
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
          api<{ configJson?: Record<string, unknown> | null } | null>(`/plugins/${pluginId}/config`),
          api<CompanySecret[]>(`/companies/${companyId}/secrets`),
        ]);

        if (cancelled) return;
        const nextConfig = (configResponse?.configJson ?? {}) as PluginConfig;
        setConfig(nextConfig);
        setSecrets(secretsResponse);
        setMcpUrl(
          typeof nextConfig.semanticCoreMcpUrl === "string"
            ? nextConfig.semanticCoreMcpUrl
            : DEFAULT_SEMANTIC_CORE_MCP_URL,
        );
        setAllowedProjectIdsCsv(
          typeof nextConfig.allowedProjectIdsCsv === "string"
            ? nextConfig.allowedProjectIdsCsv
            : "",
        );
        setAllowedClientKeysCsv(
          typeof nextConfig.allowedClientKeysCsv === "string"
            ? nextConfig.allowedClientKeysCsv
            : "",
        );
        setRequestTimeoutMs(
          typeof nextConfig.requestTimeoutMs === "number"
            ? String(nextConfig.requestTimeoutMs)
            : "180000",
        );
        setPollIntervalMs(
          typeof nextConfig.pollIntervalMs === "number"
            ? String(nextConfig.pollIntervalMs)
            : "2000",
        );
        setRunWaitTimeoutMs(
          typeof nextConfig.runWaitTimeoutMs === "number"
            ? String(nextConfig.runWaitTimeoutMs)
            : "600000",
        );
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load Semantic Core MCP plugin settings.",
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
    (secret: CompanySecret) => secret.id === config.semanticCoreMcpTokenSecretRef,
  );

  async function handleSave() {
    if (!companyId || !pluginId) return;
    setSaving(true);
    setMessage(null);

    try {
      let secretId = config.semanticCoreMcpTokenSecretRef ?? "";
      const trimmedToken = token.trim();

      if (trimmedToken.length > 0) {
        if (secretId) {
          await api(`/secrets/${secretId}/rotate`, {
            method: "POST",
            body: JSON.stringify({ value: trimmedToken }),
          });
        } else {
          const created = await api<CompanySecret>(
            `/companies/${companyId}/secrets`,
            {
              method: "POST",
              body: JSON.stringify({
                name: "Semantic Core MCP Token",
                description:
                  "Bearer token for the Semantic Core MCP endpoint.",
                value: trimmedToken,
              }),
            },
          );
          secretId = created.id;
        }
      }

      const nextConfig: PluginConfig = {
        semanticCoreMcpTokenSecretRef: secretId || "",
        semanticCoreMcpUrl: mcpUrl.trim(),
        allowedProjectIdsCsv: allowedProjectIdsCsv.trim(),
        allowedClientKeysCsv: allowedClientKeysCsv.trim(),
        requestTimeoutMs: readPositiveNumber(requestTimeoutMs, 180_000),
        pollIntervalMs: readPositiveNumber(pollIntervalMs, 2_000),
        runWaitTimeoutMs: readPositiveNumber(runWaitTimeoutMs, 600_000),
      };

      await api(`/plugins/${pluginId}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig }),
      });

      const nextSecrets = await api<CompanySecret[]>(`/companies/${companyId}/secrets`);
      setConfig(nextConfig);
      setSecrets(nextSecrets);
      setToken("");
      setReplaceToken(false);
      setMessage({
        tone: "success",
        message: "Semantic Core MCP plugin settings saved.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save Semantic Core MCP plugin settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return (
      <div style={cardStyle}>
        Select a company to configure the Semantic Core MCP plugin.
      </div>
    );
  }

  if (loading) {
    return <div style={cardStyle}>Loading Semantic Core MCP plugin settings...</div>;
  }

  return (
    <div style={stackStyle}>
      <div style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label style={labelStyle}>MCP endpoint</label>
            <input
              style={inputStyle}
              value={mcpUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setMcpUrl(event.target.value)
              }
              placeholder="http://100.98.5.50:8001/mcp"
            />
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Backend only. Agents cannot override this URL in tool calls.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Allowed project IDs</label>
            <input
              style={inputStyle}
              value={allowedProjectIdsCsv}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setAllowedProjectIdsCsv(event.target.value)
              }
              placeholder="astrogen-ukraine,diskinternals-us"
            />
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Optional semantic <code>project_id</code> allowlist. Empty allows all project IDs.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Allowed client keys</label>
            <input
              style={inputStyle}
              value={allowedClientKeysCsv}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setAllowedClientKeysCsv(event.target.value)
              }
              placeholder="diskinternals-us"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
            <div>
              <label style={labelStyle}>Request timeout, ms</label>
              <input
                style={inputStyle}
                type="number"
                min={1000}
                value={requestTimeoutMs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setRequestTimeoutMs(event.target.value)
                }
              />
            </div>
            <div>
              <label style={labelStyle}>Poll interval, ms</label>
              <input
                style={inputStyle}
                type="number"
                min={500}
                value={pollIntervalMs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setPollIntervalMs(event.target.value)
                }
              />
            </div>
            <div>
              <label style={labelStyle}>Run wait timeout, ms</label>
              <input
                style={inputStyle}
                type="number"
                min={1000}
                value={runWaitTimeoutMs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setRunWaitTimeoutMs(event.target.value)
                }
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Bearer token</label>
            {config.semanticCoreMcpTokenSecretRef && !replaceToken ? (
              <div style={{ display: "grid", gap: "8px" }}>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    background:
                      "color-mix(in srgb, var(--muted, #888) 14%, transparent)",
                  }}
                >
                  {formatSecretStatus(currentSecret)}
                </div>
                <button
                  style={buttonStyle}
                  onClick={() => setReplaceToken(true)}
                  disabled={saving}
                >
                  Replace token
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                <input
                  style={inputStyle}
                  type="password"
                  value={token}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setToken(event.target.value)
                  }
                  placeholder={
                    config.semanticCoreMcpTokenSecretRef
                      ? "Enter a new MCP token"
                      : "Required MCP token"
                  }
                />
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)", margin: 0 }}>
                  Stored in Paperclip Secrets. Plugin config keeps only the secret reference.
                </p>
                {config.semanticCoreMcpTokenSecretRef ? (
                  <button
                    style={buttonStyle}
                    onClick={() => {
                      setReplaceToken(false);
                      setToken("");
                    }}
                    disabled={saving}
                  >
                    Keep existing token
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {message ? (
        <div
          style={{
            ...cardStyle,
            borderColor:
              message.tone === "success"
                ? "color-mix(in srgb, #16a34a 55%, var(--border))"
                : "color-mix(in srgb, #dc2626 55%, var(--border))",
          }}
        >
          {message.message}
        </div>
      ) : null}

      <button
        style={primaryButtonStyle}
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </div>
  );
}
