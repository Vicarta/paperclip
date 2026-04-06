import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { DEFAULT_DATAFORSEO_API_BASE_URL } from "../constants.js";

type PluginConfig = {
  dataforseoApiLoginSecretRef?: string;
  dataforseoApiPasswordSecretRef?: string;
  dataforseoApiBaseUrl?: string;
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

function formatSecretStatus(secret: CompanySecret | undefined, fallback: string) {
  if (!secret) return fallback;
  return `Configured via secret: ${secret.name}`;
}

async function upsertSecret(input: {
  companyId: string;
  existingSecretRef?: string;
  value: string;
  name: string;
  description: string;
}) {
  const trimmedValue = input.value.trim();
  if (!trimmedValue) return input.existingSecretRef ?? "";

  if (input.existingSecretRef) {
    await api(`/secrets/${input.existingSecretRef}/rotate`, {
      method: "POST",
      body: JSON.stringify({ value: trimmedValue }),
    });
    return input.existingSecretRef;
  }

  const created = await api<CompanySecret>(`/companies/${input.companyId}/secrets`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      value: trimmedValue,
    }),
  });
  return created.id;
}

function SecretField(props: {
  label: string;
  configured: boolean;
  configuredText: string;
  placeholder: string;
  replaceMode: boolean;
  value: string;
  saving: boolean;
  onToggleReplace: (next: boolean) => void;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{props.label}</label>
      {props.configured && !props.replaceMode ? (
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
            {props.configuredText}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              style={buttonStyle}
              onClick={() => props.onToggleReplace(true)}
              disabled={props.saving}
            >
              Replace value
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          <input
            style={inputStyle}
            type="password"
            value={props.value}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              props.onChange(event.target.value)
            }
            placeholder={props.placeholder}
          />
          {props.configured ? (
            <button
              style={buttonStyle}
              onClick={() => props.onToggleReplace(false)}
              disabled={props.saving}
            >
              Keep existing value
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function DataForSeoSettingsPage({ context }: PluginSettingsPageProps) {
  const pluginId = useMemo(() => readPluginIdFromLocation(), []);
  const companyId = context.companyId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveState>(null);
  const [config, setConfig] = useState<PluginConfig>({});
  const [secrets, setSecrets] = useState<CompanySecret[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_DATAFORSEO_API_BASE_URL);
  const [replaceLogin, setReplaceLogin] = useState(false);
  const [replacePassword, setReplacePassword] = useState(false);
  const [apiLogin, setApiLogin] = useState("");
  const [apiPassword, setApiPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!pluginId || !companyId) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const [configResponse, secretsResponse] = await Promise.all([
          api<{ configJson?: Record<string, unknown> | null } | null>(
            `/plugins/${pluginId}/config`,
          ),
          api<CompanySecret[]>(`/companies/${companyId}/secrets`),
        ]);

        if (cancelled) return;
        const nextConfig = (configResponse?.configJson ?? {}) as PluginConfig;
        setConfig(nextConfig);
        setSecrets(secretsResponse);
        setApiBaseUrl(
          typeof nextConfig.dataforseoApiBaseUrl === "string" &&
            nextConfig.dataforseoApiBaseUrl.trim().length > 0
            ? nextConfig.dataforseoApiBaseUrl
            : DEFAULT_DATAFORSEO_API_BASE_URL,
        );
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load DataForSEO plugin settings.",
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

  const loginSecret = secrets.find(
    (secret) => secret.id === config.dataforseoApiLoginSecretRef,
  );
  const passwordSecret = secrets.find(
    (secret) => secret.id === config.dataforseoApiPasswordSecretRef,
  );

  async function handleSave() {
    if (!companyId || !pluginId) return;
    setSaving(true);
    setMessage(null);

    try {
      const [loginSecretRef, passwordSecretRef] = await Promise.all([
        upsertSecret({
          companyId,
          existingSecretRef: config.dataforseoApiLoginSecretRef,
          value: apiLogin,
          name: "DataForSEO API Login",
          description: "API login used by the DataForSEO Agent Tools plugin.",
        }),
        upsertSecret({
          companyId,
          existingSecretRef: config.dataforseoApiPasswordSecretRef,
          value: apiPassword,
          name: "DataForSEO API Password",
          description: "API password used by the DataForSEO Agent Tools plugin.",
        }),
      ]);

      const nextConfig: PluginConfig = {
        dataforseoApiBaseUrl: apiBaseUrl.trim() || DEFAULT_DATAFORSEO_API_BASE_URL,
        dataforseoApiLoginSecretRef: loginSecretRef || "",
        dataforseoApiPasswordSecretRef: passwordSecretRef || "",
      };

      await api(`/plugins/${pluginId}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig }),
      });

      const nextSecrets = await api<CompanySecret[]>(`/companies/${companyId}/secrets`);
      setConfig(nextConfig);
      setSecrets(nextSecrets);
      setApiLogin("");
      setApiPassword("");
      setReplaceLogin(false);
      setReplacePassword(false);
      setMessage({
        tone: "success",
        message: "DataForSEO plugin settings saved.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save DataForSEO plugin settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return (
      <div style={cardStyle}>
        Select a company to configure the DataForSEO plugin.
      </div>
    );
  }

  if (loading) {
    return <div style={cardStyle}>Loading DataForSEO plugin settings…</div>;
  }

  return (
    <div style={stackStyle}>
      <div style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label style={labelStyle}>DataForSEO API Base URL</label>
            <input
              style={inputStyle}
              value={apiBaseUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setApiBaseUrl(event.target.value)
              }
              placeholder={DEFAULT_DATAFORSEO_API_BASE_URL}
            />
            <p
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "var(--muted-foreground)",
              }}
            >
              Defaults to the official DataForSEO API endpoint.
            </p>
          </div>

          <SecretField
            label="DataForSEO API Login"
            configured={Boolean(config.dataforseoApiLoginSecretRef)}
            configuredText={formatSecretStatus(loginSecret, "Login configured")}
            placeholder={
              config.dataforseoApiLoginSecretRef
                ? "Enter a new DataForSEO API login"
                : "Enter DataForSEO API login"
            }
            replaceMode={replaceLogin}
            value={apiLogin}
            saving={saving}
            onToggleReplace={setReplaceLogin}
            onChange={setApiLogin}
          />

          <SecretField
            label="DataForSEO API Password"
            configured={Boolean(config.dataforseoApiPasswordSecretRef)}
            configuredText={formatSecretStatus(
              passwordSecret,
              "Password configured",
            )}
            placeholder={
              config.dataforseoApiPasswordSecretRef
                ? "Enter a new DataForSEO API password"
                : "Enter DataForSEO API password"
            }
            replaceMode={replacePassword}
            value={apiPassword}
            saving={saving}
            onToggleReplace={setReplacePassword}
            onChange={setApiPassword}
          />

          {message ? (
            <div
              style={{
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13px",
                border: `1px solid ${
                  message.tone === "success"
                    ? "color-mix(in srgb, green 55%, var(--border))"
                    : "color-mix(in srgb, red 55%, var(--border))"
                }`,
              }}
            >
              {message.message}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              style={primaryButtonStyle}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataForSeoSettingsPage;
