import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import {
  DEFAULT_CRAWLOBSERVER_BASE_URL,
  DEFAULT_MAX_PAGE_LIMIT,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "../constants.js";

type PluginConfig = {
  crawlObserverApiKeySecretRef?: string;
  crawlObserverBaseUrl?: string;
  allowedProjectId?: string;
  allowMutatingTools?: boolean;
  requestTimeoutMs?: number;
  maxPageLimit?: number;
};

type CompanySecret = {
  id: string;
  name: string;
  description?: string | null;
};

type SaveState = { tone: "success" | "error"; message: string } | null;

const stackStyle: CSSProperties = { display: "grid", gap: "14px" };
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

export function CrawlObserverSettingsPage({ context }: PluginSettingsPageProps) {
  const pluginId = useMemo(() => readPluginIdFromLocation(), []);
  const companyId = context.companyId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveState>(null);
  const [config, setConfig] = useState<PluginConfig>({});
  const [secrets, setSecrets] = useState<CompanySecret[]>([]);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_CRAWLOBSERVER_BASE_URL);
  const [allowedProjectId, setAllowedProjectId] = useState("");
  const [allowMutatingTools, setAllowMutatingTools] = useState(false);
  const [requestTimeoutMs, setRequestTimeoutMs] = useState(String(DEFAULT_REQUEST_TIMEOUT_MS));
  const [maxPageLimit, setMaxPageLimit] = useState(String(DEFAULT_MAX_PAGE_LIMIT));
  const [apiKey, setApiKey] = useState("");

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
        setBaseUrl(nextConfig.crawlObserverBaseUrl || DEFAULT_CRAWLOBSERVER_BASE_URL);
        setAllowedProjectId(nextConfig.allowedProjectId || "");
        setAllowMutatingTools(nextConfig.allowMutatingTools === true);
        setRequestTimeoutMs(String(nextConfig.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS));
        setMaxPageLimit(String(nextConfig.maxPageLimit || DEFAULT_MAX_PAGE_LIMIT));
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load settings.",
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
    (secret) => secret.id === config.crawlObserverApiKeySecretRef,
  );

  async function handleSave() {
    if (!companyId || !pluginId) return;
    setSaving(true);
    setMessage(null);
    try {
      let secretId = config.crawlObserverApiKeySecretRef || "";
      const trimmedApiKey = apiKey.trim();
      if (trimmedApiKey.length > 0) {
        if (secretId) {
          await api(`/secrets/${secretId}/rotate`, {
            method: "POST",
            body: JSON.stringify({ value: trimmedApiKey }),
          });
        } else {
          const created = await api<CompanySecret>(`/companies/${companyId}/secrets`, {
            method: "POST",
            body: JSON.stringify({
              name: "CrawlObserver API Key",
              description: "Private Tailnet CrawlObserver API key for Paperclip agent tools.",
              value: trimmedApiKey,
            }),
          });
          secretId = created.id;
        }
      }

      const nextConfig: PluginConfig = {
        crawlObserverApiKeySecretRef: secretId,
        crawlObserverBaseUrl: baseUrl.trim() || DEFAULT_CRAWLOBSERVER_BASE_URL,
        allowedProjectId: allowedProjectId.trim(),
        allowMutatingTools,
        requestTimeoutMs: readPositiveNumber(requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS),
        maxPageLimit: readPositiveNumber(maxPageLimit, DEFAULT_MAX_PAGE_LIMIT),
      };
      await api(`/plugins/${pluginId}/config`, {
        method: "PUT",
        body: JSON.stringify({ configJson: nextConfig }),
      });
      setConfig(nextConfig);
      setApiKey("");
      setMessage({ tone: "success", message: "CrawlObserver settings saved." });
    } catch (error) {
      setMessage({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={cardStyle}>Loading CrawlObserver settings...</div>;

  return (
    <div style={stackStyle}>
      <div>
        <h2 style={{ margin: 0 }}>CrawlObserver Agent Tools</h2>
        <p style={{ margin: "6px 0 0", color: "var(--muted-foreground)" }}>
          Server-side Tailnet adapter. Agents never receive the API key.
        </p>
      </div>

      {message ? (
        <div
          style={{
            ...cardStyle,
            borderColor: message.tone === "success" ? "var(--success)" : "var(--destructive)",
          }}
        >
          {message.message}
        </div>
      ) : null}

      <div style={cardStyle}>
        <label style={labelStyle}>Base URL</label>
        <input
          style={inputStyle}
          value={baseUrl}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setBaseUrl(event.target.value)}
        />
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>API key</label>
        <input
          style={inputStyle}
          type="password"
          placeholder={currentSecret ? `Configured via ${currentSecret.name}` : "Paste API key"}
          value={apiKey}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setApiKey(event.target.value)}
        />
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>Allowed project ID</label>
        <input
          style={inputStyle}
          placeholder="Optional project guardrail"
          value={allowedProjectId}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setAllowedProjectId(event.target.value)}
        />
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>Request timeout ms</label>
        <input
          style={inputStyle}
          value={requestTimeoutMs}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setRequestTimeoutMs(event.target.value)}
        />
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>Max page limit</label>
        <input
          style={inputStyle}
          value={maxPageLimit}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setMaxPageLimit(event.target.value)}
        />
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={allowMutatingTools}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setAllowMutatingTools(event.target.checked)
          }
        />
        Allow crawl start/stop/resume/retry tools
      </label>

      <div>
        <button style={primaryButtonStyle} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
