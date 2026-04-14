import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { DEFAULT_SERPER_API_BASE_URL } from "../constants.js";

type PluginConfig = {
  serperApiKeySecretRef?: string;
  serperApiBaseUrl?: string;
};

type CompanySecret = {
  id: string;
  name: string;
  description?: string | null;
  updatedAt?: string;
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

export function SerperSettingsPage({ context }: PluginSettingsPageProps) {
  const pluginId = useMemo(() => readPluginIdFromLocation(), []);
  const companyId = context.companyId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveState>(null);
  const [config, setConfig] = useState<PluginConfig>({});
  const [secrets, setSecrets] = useState<CompanySecret[]>([]);
  const [serperApiBaseUrl, setSerperApiBaseUrl] = useState(
    DEFAULT_SERPER_API_BASE_URL,
  );
  const [replaceKey, setReplaceKey] = useState(false);
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
        setSerperApiBaseUrl(
          typeof nextConfig.serperApiBaseUrl === "string" &&
            nextConfig.serperApiBaseUrl.trim().length > 0
            ? nextConfig.serperApiBaseUrl
            : DEFAULT_SERPER_API_BASE_URL,
        );
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load Serper plugin settings.",
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
    (secret: CompanySecret) => secret.id === config.serperApiKeySecretRef,
  );

  async function handleSave() {
    if (!companyId || !pluginId) return;
    setSaving(true);
    setMessage(null);

    try {
      let secretId = config.serperApiKeySecretRef ?? "";
      const trimmedKey = apiKey.trim();

      if (trimmedKey.length > 0) {
        if (secretId) {
          await api(`/secrets/${secretId}/rotate`, {
            method: "POST",
            body: JSON.stringify({ value: trimmedKey }),
          });
        } else {
          const created = await api<CompanySecret>(
            `/companies/${companyId}/secrets`,
            {
              method: "POST",
              body: JSON.stringify({
                name: "Serper API Key",
                description: "API key used by the Serper Agent Tools plugin.",
                value: trimmedKey,
              }),
            },
          );
          secretId = created.id;
        }
      }

      const nextConfig: PluginConfig = {
        serperApiBaseUrl: serperApiBaseUrl.trim() || DEFAULT_SERPER_API_BASE_URL,
        serperApiKeySecretRef: secretId || "",
      };

      await api(`/plugins/${pluginId}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig }),
      });

      const nextSecrets = companyId
        ? await api<CompanySecret[]>(`/companies/${companyId}/secrets`)
        : [];

      setConfig(nextConfig);
      setSecrets(nextSecrets);
      setApiKey("");
      setReplaceKey(false);
      setMessage({ tone: "success", message: "Serper plugin settings saved." });
    } catch (error) {
      setMessage({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save Serper plugin settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return (
      <div style={cardStyle}>Select a company to configure the Serper plugin.</div>
    );
  }

  if (loading) {
    return <div style={cardStyle}>Loading Serper plugin settings…</div>;
  }

  return (
    <div style={stackStyle}>
      <div style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Serper API Base URL</label>
            <input
              style={inputStyle}
              value={serperApiBaseUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSerperApiBaseUrl(event.target.value)
              }
              placeholder={DEFAULT_SERPER_API_BASE_URL}
            />
            <p
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "var(--muted-foreground)",
              }}
            >
              Defaults to the official Serper REST endpoint.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Serper API Key</label>
            {config.serperApiKeySecretRef && !replaceKey ? (
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
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    style={buttonStyle}
                    onClick={() => setReplaceKey(true)}
                    disabled={saving}
                  >
                    Replace key
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                <input
                  style={inputStyle}
                  type="password"
                  value={apiKey}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setApiKey(event.target.value)
                  }
                  placeholder={
                    config.serperApiKeySecretRef
                      ? "Enter a new Serper API key"
                      : "Enter Serper API key"
                  }
                />
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--muted-foreground)",
                    margin: 0,
                  }}
                >
                  The key is stored once in Paperclip Secrets. Plugin config
                  keeps only the secret reference.
                </p>
                {config.serperApiKeySecretRef ? (
                  <button
                    style={buttonStyle}
                    onClick={() => {
                      setReplaceKey(false);
                      setApiKey("");
                    }}
                    disabled={saving}
                  >
                    Keep existing key
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

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          style={primaryButtonStyle}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
