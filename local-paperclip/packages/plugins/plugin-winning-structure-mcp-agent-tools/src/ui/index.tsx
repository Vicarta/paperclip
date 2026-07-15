import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { DEFAULT_WINNING_STRUCTURE_MCP_URL } from "../constants.js";

type PluginConfig = {
  winningStructureMcpTokenSecretRef?: string;
  winningStructureMcpUrl?: string;
  allowedClientKeysCsv?: string;
  requestTimeoutMs?: number;
  costAccountingMode?: "provider_reported" | "disabled";
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

function formatSecretStatus(secret: CompanySecret | undefined) {
  if (!secret) return "Configured";
  return `Configured via secret: ${secret.name}`;
}

function readPositiveNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 180_000;
}

export function WinningStructureMcpSettingsPage({ context }: PluginSettingsPageProps) {
  const pluginId = useMemo(() => readPluginIdFromLocation(), []);
  const companyId = context.companyId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveState>(null);
  const [config, setConfig] = useState<PluginConfig>({});
  const [secrets, setSecrets] = useState<CompanySecret[]>([]);
  const [mcpUrl, setMcpUrl] = useState(DEFAULT_WINNING_STRUCTURE_MCP_URL);
  const [allowedClientKeysCsv, setAllowedClientKeysCsv] = useState("");
  const [requestTimeoutMs, setRequestTimeoutMs] = useState("180000");
  const [costAccountingMode, setCostAccountingMode] = useState<"provider_reported" | "disabled">("provider_reported");
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
          typeof nextConfig.winningStructureMcpUrl === "string"
            ? nextConfig.winningStructureMcpUrl
            : DEFAULT_WINNING_STRUCTURE_MCP_URL,
        );
        setAllowedClientKeysCsv(
          typeof nextConfig.allowedClientKeysCsv === "string"
            ? nextConfig.allowedClientKeysCsv
            : "",
        );
        setRequestTimeoutMs(
          typeof nextConfig.requestTimeoutMs === "number" &&
            Number.isFinite(nextConfig.requestTimeoutMs)
            ? String(nextConfig.requestTimeoutMs)
            : "180000",
        );
        setCostAccountingMode(
          nextConfig.costAccountingMode === "disabled" ? "disabled" : "provider_reported",
        );
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load Winning Structure MCP plugin settings.",
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
    (secret: CompanySecret) => secret.id === config.winningStructureMcpTokenSecretRef,
  );

  async function handleSave() {
    if (!companyId || !pluginId) return;
    setSaving(true);
    setMessage(null);

    try {
      let secretId = config.winningStructureMcpTokenSecretRef ?? "";
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
                name: "Winning Structure MCP Token",
                description:
                  "Optional bearer token for the Winning Structure MCP endpoint.",
                value: trimmedToken,
              }),
            },
          );
          secretId = created.id;
        }
      }

      const nextConfig: PluginConfig = {
        winningStructureMcpTokenSecretRef: secretId || "",
        winningStructureMcpUrl: mcpUrl.trim(),
        allowedClientKeysCsv: allowedClientKeysCsv.trim(),
        requestTimeoutMs: readPositiveNumber(requestTimeoutMs),
        costAccountingMode,
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
        message: "Winning Structure MCP plugin settings saved.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save Winning Structure MCP plugin settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return (
      <div style={cardStyle}>
        Select a company to configure the Winning Structure MCP plugin.
      </div>
    );
  }

  if (loading) {
    return <div style={cardStyle}>Loading Winning Structure MCP plugin settings...</div>;
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
              placeholder="https://winning-structure.example.test/mcp"
            />
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Backend only. Agents cannot override this URL in tool calls.
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
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Optional comma-separated allowlist for task <code>client_key</code>. Empty allows all client keys.
            </p>
          </div>

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
            <label style={labelStyle}>Cost accounting</label>
            <select
              style={inputStyle}
              value={costAccountingMode}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setCostAccountingMode(event.target.value === "disabled" ? "disabled" : "provider_reported")
              }
            >
              <option value="provider_reported">Provider reported</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Bearer token</label>
            {config.winningStructureMcpTokenSecretRef && !replaceToken ? (
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
                    config.winningStructureMcpTokenSecretRef
                      ? "Enter a new MCP token"
                      : "Optional MCP token"
                  }
                />
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)", margin: 0 }}>
                  Stored in Paperclip Secrets. Plugin config keeps only the secret reference.
                </p>
                {config.winningStructureMcpTokenSecretRef ? (
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
