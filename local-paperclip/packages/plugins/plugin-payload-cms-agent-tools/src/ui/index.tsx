import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import {
  DEFAULT_AUTHORS_COLLECTION,
  DEFAULT_BLOG_POSTS_COLLECTION,
  DEFAULT_BUILD_STATE_GLOBAL,
  DEFAULT_CATEGORIES_COLLECTION,
  DEFAULT_MEDIA_COLLECTION,
  DEFAULT_PAYLOAD_API_BASE_URL,
  DEFAULT_TAGS_COLLECTION,
} from "../constants.js";

type PluginConfig = {
  payloadApiKeySecretRef?: string;
  payloadApiBaseUrl?: string;
  authCollectionSlug?: string;
  blogPostsCollectionSlug?: string;
  mediaCollectionSlug?: string;
  categoriesCollectionSlug?: string;
  tagsCollectionSlug?: string;
  authorsCollectionSlug?: string;
  buildStateGlobalSlug?: string;
  requestTimeoutMs?: number;
};

type CompanySecret = {
  id: string;
  name: string;
  description?: string | null;
  updatedAt?: string;
};

type SaveState = { tone: "success" | "error"; message: string } | null;

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

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
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

function field(name: string, value: string | number | undefined, setter: (next: string) => void) {
  return (
    <div>
      <label style={labelStyle}>{name}</label>
      <input
        style={inputStyle}
        value={value ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setter(event.target.value)}
      />
    </div>
  );
}

export function PayloadCmsSettingsPage({ context }: PluginSettingsPageProps) {
  const pluginId = useMemo(() => readPluginIdFromLocation(), []);
  const companyId = context.companyId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveState>(null);
  const [config, setConfig] = useState<PluginConfig>({});
  const [secrets, setSecrets] = useState<CompanySecret[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_PAYLOAD_API_BASE_URL);
  const [apiKey, setApiKey] = useState("");
  const [replaceKey, setReplaceKey] = useState(false);
  const [authCollectionSlug, setAuthCollectionSlug] = useState("users");
  const [blogPostsCollectionSlug, setBlogPostsCollectionSlug] = useState(DEFAULT_BLOG_POSTS_COLLECTION);
  const [mediaCollectionSlug, setMediaCollectionSlug] = useState(DEFAULT_MEDIA_COLLECTION);
  const [categoriesCollectionSlug, setCategoriesCollectionSlug] = useState(DEFAULT_CATEGORIES_COLLECTION);
  const [tagsCollectionSlug, setTagsCollectionSlug] = useState(DEFAULT_TAGS_COLLECTION);
  const [authorsCollectionSlug, setAuthorsCollectionSlug] = useState(DEFAULT_AUTHORS_COLLECTION);
  const [buildStateGlobalSlug, setBuildStateGlobalSlug] = useState(DEFAULT_BUILD_STATE_GLOBAL);
  const [requestTimeoutMs, setRequestTimeoutMs] = useState("60000");

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
        setApiBaseUrl(nextConfig.payloadApiBaseUrl || DEFAULT_PAYLOAD_API_BASE_URL);
        setAuthCollectionSlug(nextConfig.authCollectionSlug || "users");
        setBlogPostsCollectionSlug(nextConfig.blogPostsCollectionSlug || DEFAULT_BLOG_POSTS_COLLECTION);
        setMediaCollectionSlug(nextConfig.mediaCollectionSlug || DEFAULT_MEDIA_COLLECTION);
        setCategoriesCollectionSlug(nextConfig.categoriesCollectionSlug || DEFAULT_CATEGORIES_COLLECTION);
        setTagsCollectionSlug(nextConfig.tagsCollectionSlug || DEFAULT_TAGS_COLLECTION);
        setAuthorsCollectionSlug(nextConfig.authorsCollectionSlug || DEFAULT_AUTHORS_COLLECTION);
        setBuildStateGlobalSlug(nextConfig.buildStateGlobalSlug || DEFAULT_BUILD_STATE_GLOBAL);
        setRequestTimeoutMs(String(nextConfig.requestTimeoutMs ?? 60000));
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load Payload CMS settings.",
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

  const currentSecret = secrets.find((secret) => secret.id === config.payloadApiKeySecretRef);

  async function handleSave() {
    if (!companyId || !pluginId) return;
    setSaving(true);
    setMessage(null);
    try {
      let secretId = config.payloadApiKeySecretRef ?? "";
      const trimmedKey = apiKey.trim();
      if (trimmedKey) {
        if (secretId) {
          await api(`/secrets/${secretId}/rotate`, {
            method: "POST",
            body: JSON.stringify({ value: trimmedKey }),
          });
        } else {
          const created = await api<CompanySecret>(`/companies/${companyId}/secrets`, {
            method: "POST",
            body: JSON.stringify({
              name: "Astrogen Payload CMS API Key",
              description: "Payload users API key used by the Payload CMS Agent Tools plugin.",
              value: trimmedKey,
            }),
          });
          secretId = created.id;
        }
      }

      const nextConfig: PluginConfig = {
        payloadApiKeySecretRef: secretId,
        payloadApiBaseUrl: apiBaseUrl.trim() || DEFAULT_PAYLOAD_API_BASE_URL,
        authCollectionSlug: authCollectionSlug.trim() || "users",
        blogPostsCollectionSlug: blogPostsCollectionSlug.trim() || DEFAULT_BLOG_POSTS_COLLECTION,
        mediaCollectionSlug: mediaCollectionSlug.trim() || DEFAULT_MEDIA_COLLECTION,
        categoriesCollectionSlug: categoriesCollectionSlug.trim() || DEFAULT_CATEGORIES_COLLECTION,
        tagsCollectionSlug: tagsCollectionSlug.trim() || DEFAULT_TAGS_COLLECTION,
        authorsCollectionSlug: authorsCollectionSlug.trim() || DEFAULT_AUTHORS_COLLECTION,
        buildStateGlobalSlug: buildStateGlobalSlug.trim() || DEFAULT_BUILD_STATE_GLOBAL,
        requestTimeoutMs: Number(requestTimeoutMs) || 60000,
      };

      await api(`/plugins/${pluginId}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig }),
      });

      setConfig(nextConfig);
      setSecrets(await api<CompanySecret[]>(`/companies/${companyId}/secrets`));
      setApiKey("");
      setReplaceKey(false);
      setMessage({ tone: "success", message: "Payload CMS settings saved." });
    } catch (error) {
      setMessage({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save Payload CMS settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={cardStyle}>Loading Payload CMS settings...</div>;

  return (
    <div style={stackStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Payload CMS Agent Tools</h2>
        <p style={{ color: "var(--muted-foreground)", marginBottom: 0 }}>
          Server-side connector for Payload blog drafts, media uploads, guarded publishing, and build-state checks.
        </p>
      </div>

      {message ? (
        <div
          style={{
            ...cardStyle,
            borderColor: message.tone === "success" ? "#27a36a" : "#c93b3b",
          }}
        >
          {message.message}
        </div>
      ) : null}

      <div style={cardStyle}>
        <div style={stackStyle}>
          {field("Payload API Base URL", apiBaseUrl, setApiBaseUrl)}
          <div>
            <label style={labelStyle}>Payload users API key</label>
            {currentSecret && !replaceKey ? (
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ ...inputStyle, background: "color-mix(in srgb, var(--muted, #888) 14%, transparent)" }}>
                  Configured via secret: {currentSecret.name}
                </div>
                <button style={buttonStyle} onClick={() => setReplaceKey(true)} disabled={saving}>
                  Replace key
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                <input
                  style={inputStyle}
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="users API key"
                />
                {currentSecret ? (
                  <button style={buttonStyle} onClick={() => setReplaceKey(false)} disabled={saving}>
                    Keep existing key
                  </button>
                ) : null}
              </div>
            )}
          </div>
          <div style={twoColumnStyle}>
            {field("Auth collection", authCollectionSlug, setAuthCollectionSlug)}
            {field("Blog posts collection", blogPostsCollectionSlug, setBlogPostsCollectionSlug)}
            {field("Media collection", mediaCollectionSlug, setMediaCollectionSlug)}
            {field("Categories collection", categoriesCollectionSlug, setCategoriesCollectionSlug)}
            {field("Tags collection", tagsCollectionSlug, setTagsCollectionSlug)}
            {field("Authors collection", authorsCollectionSlug, setAuthorsCollectionSlug)}
            {field("Build state global", buildStateGlobalSlug, setBuildStateGlobalSlug)}
            {field("Request timeout ms", requestTimeoutMs, setRequestTimeoutMs)}
          </div>
          <div>
            <button style={primaryButtonStyle} onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
