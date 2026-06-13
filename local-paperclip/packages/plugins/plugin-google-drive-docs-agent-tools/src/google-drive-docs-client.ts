import { createSign, randomUUID } from "node:crypto";
import {
  DEFAULT_GOOGLE_DOCS_API_BASE_URL,
  DEFAULT_GOOGLE_DRIVE_API_BASE_URL,
  DEFAULT_GOOGLE_DRIVE_UPLOAD_BASE_URL,
  DEFAULT_GOOGLE_TOKEN_URI,
} from "./constants.js";

const DOCS_SCOPE = "https://www.googleapis.com/auth/documents";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export type GoogleDriveDocsPluginConfig = {
  googleServiceAccountJsonSecretRef?: string;
  defaultFolderId?: string;
  allowedFolderIds?: string[];
  driveApiBaseUrl?: string;
  driveUploadBaseUrl?: string;
  docsApiBaseUrl?: string;
  defaultShareType?: "user" | "group" | "domain" | "anyone";
  defaultShareRole?: "reader" | "commenter" | "writer";
  defaultShareEmailAddress?: string;
  defaultShareDomain?: string;
};

export type ClientDeps = {
  config: GoogleDriveDocsPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn: typeof fetch;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = asString(record[key]);
  if (!value) throw new Error(`Service account JSON is missing ${key}`);
  return value;
}

function parseServiceAccount(jsonText: string): ServiceAccount {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!isRecord(parsed)) throw new Error("Service account secret must contain a JSON object");
  return {
    client_email: requireString(parsed, "client_email"),
    private_key: requireString(parsed, "private_key").replace(/\\n/g, "\n"),
    token_uri: asString(parsed.token_uri),
  };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(serviceAccount: ServiceAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: serviceAccount.client_email,
    scope: `${DRIVE_SCOPE} ${DOCS_SCOPE}`,
    aud: serviceAccount.token_uri || DEFAULT_GOOGLE_TOKEN_URI,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64url(signer.sign(serviceAccount.private_key))}`;
}

async function getAccessToken(deps: ClientDeps): Promise<string> {
  const secretRef = deps.config.googleServiceAccountJsonSecretRef?.trim();
  if (!secretRef) throw new Error("Missing googleServiceAccountJsonSecretRef");

  const serviceAccount = parseServiceAccount(await deps.resolveSecret(secretRef));
  const tokenUri = serviceAccount.token_uri || DEFAULT_GOOGLE_TOKEN_URI;
  const assertion = signJwt(serviceAccount);

  const response = await deps.fetchFn(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google OAuth token request failed: ${response.status} ${data.error ?? ""}`.trim());
  }
  return data.access_token;
}

async function googleFetch(
  deps: ClientDeps,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const token = await getAccessToken(deps);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return deps.fetchFn(url, { ...init, headers });
}

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

function assertSafeHtml(html: string): void {
  if (/<script[\s>]/i.test(html) || /javascript:/i.test(html)) {
    throw new Error("Unsafe HTML is not allowed in Google Docs import");
  }
}

function resolveFolderId(config: GoogleDriveDocsPluginConfig, requestedFolderId?: string): string | undefined {
  const folderId = requestedFolderId?.trim() || config.defaultFolderId?.trim() || undefined;
  const allowlist = config.allowedFolderIds?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (folderId && allowlist.length > 0 && !allowlist.includes(folderId)) {
    throw new Error("Requested folderId is not allowed by plugin configuration");
  }
  return folderId;
}

function requireParam(record: Record<string, unknown>, key: string): string {
  const value = asString(record[key]);
  if (!value) throw new Error(`Missing required parameter: ${key}`);
  return value;
}

function toRecord(params: unknown): Record<string, unknown> {
  if (!isRecord(params)) return {};
  return params;
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${text.slice(0, 500)}`.trim());
  }
  return data;
}

export async function healthCheck(deps: ClientDeps): Promise<Record<string, unknown>> {
  const response = await googleFetch(
    deps,
    `${deps.config.driveApiBaseUrl || DEFAULT_GOOGLE_DRIVE_API_BASE_URL}/about?fields=user`,
    { method: "GET" },
  );
  const data = await parseJsonResponse<Record<string, unknown>>(response, "Google Drive health check");
  return { ok: true, provider: "google-drive-docs", data };
}

export async function createDocFromHtml(
  deps: ClientDeps,
  params: unknown,
): Promise<Record<string, unknown>> {
  const input = toRecord(params);
  const title = requireParam(input, "title");
  const html = requireParam(input, "html");
  assertSafeHtml(html);

  const folderId = resolveFolderId(deps.config, asString(input.folderId));
  const metadata: Record<string, unknown> = {
    name: title,
    mimeType: "application/vnd.google-apps.document",
  };
  if (folderId) metadata.parents = [folderId];

  const boundary = `paperclip-${randomUUID()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const url =
    `${deps.config.driveUploadBaseUrl || DEFAULT_GOOGLE_DRIVE_UPLOAD_BASE_URL}` +
    "/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,parents";

  const response = await googleFetch(deps, url, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = await parseJsonResponse<Record<string, unknown>>(response, "Google Docs HTML import");
  return {
    ...data,
    documentId: data.id,
    documentUrl: data.webViewLink,
  };
}

export async function getDoc(deps: ClientDeps, params: unknown): Promise<Record<string, unknown>> {
  const input = toRecord(params);
  const documentId = requireParam(input, "documentId");
  const fields =
    asString(input.fields) ||
    "id,name,mimeType,webViewLink,parents,createdTime,modifiedTime,owners(displayName,emailAddress)";
  const response = await googleFetch(
    deps,
    `${deps.config.driveApiBaseUrl || DEFAULT_GOOGLE_DRIVE_API_BASE_URL}/files/${encodeURIComponent(documentId)}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
    { method: "GET" },
  );
  return parseJsonResponse<Record<string, unknown>>(response, "Google Drive file lookup");
}

export async function shareDoc(deps: ClientDeps, params: unknown): Promise<Record<string, unknown>> {
  const input = toRecord(params);
  const documentId = requireParam(input, "documentId");
  const type =
    asString(input.type) ||
    deps.config.defaultShareType ||
    "user";
  const role =
    asString(input.role) ||
    deps.config.defaultShareRole ||
    "reader";

  const permission: Record<string, unknown> = { type, role };
  const emailAddress = asString(input.emailAddress) || deps.config.defaultShareEmailAddress;
  const domain = asString(input.domain) || deps.config.defaultShareDomain;
  if ((type === "user" || type === "group") && !emailAddress) {
    throw new Error("emailAddress is required for user/group sharing");
  }
  if (type === "domain" && !domain) {
    throw new Error("domain is required for domain sharing");
  }
  if (emailAddress) permission.emailAddress = emailAddress;
  if (domain) permission.domain = domain;

  const response = await googleFetch(
    deps,
    `${deps.config.driveApiBaseUrl || DEFAULT_GOOGLE_DRIVE_API_BASE_URL}/files/${encodeURIComponent(documentId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false&fields=id,type,role,emailAddress,domain`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(permission),
    },
  );
  return parseJsonResponse<Record<string, unknown>>(response, "Google Drive permission create");
}

export async function replaceAllText(
  deps: ClientDeps,
  params: unknown,
): Promise<Record<string, unknown>> {
  const input = toRecord(params);
  const documentId = requireParam(input, "documentId");
  const containsText = requireParam(input, "containsText");
  const replaceText = typeof input.replaceText === "string" ? input.replaceText : "";
  const matchCase = Boolean(input.matchCase);

  return batchUpdate(deps, {
    documentId,
    requests: [
      {
        replaceAllText: {
          containsText: { text: containsText, matchCase },
          replaceText,
        },
      },
    ],
  });
}

export async function batchUpdate(
  deps: ClientDeps,
  params: unknown,
): Promise<Record<string, unknown>> {
  const input = toRecord(params);
  const documentId = requireParam(input, "documentId");
  const requests = Array.isArray(input.requests) ? input.requests : null;
  if (!requests) throw new Error("requests must be an array");
  if (requests.length > 100) throw new Error("requests cannot contain more than 100 operations");

  const response = await googleFetch(
    deps,
    `${deps.config.docsApiBaseUrl || DEFAULT_GOOGLE_DOCS_API_BASE_URL}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ requests }),
    },
  );
  return parseJsonResponse<Record<string, unknown>>(response, "Google Docs batchUpdate");
}

export async function exportDoc(deps: ClientDeps, params: unknown): Promise<Record<string, unknown>> {
  const input = toRecord(params);
  const documentId = requireParam(input, "documentId");
  const format = asString(input.format) || "html";
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    txt: "text/plain",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const mimeType = mimeTypes[format];
  if (!mimeType) throw new Error("format must be one of: html, txt, pdf, docx");

  const response = await googleFetch(
    deps,
    `${deps.config.driveApiBaseUrl || DEFAULT_GOOGLE_DRIVE_API_BASE_URL}/files/${encodeURIComponent(documentId)}/export?mimeType=${encodeURIComponent(mimeType)}`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`Google Docs export failed: ${response.status} ${(await response.text()).slice(0, 500)}`);
  }
  if (format === "html" || format === "txt") {
    return { documentId, format, mimeType, content: await response.text() };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { documentId, format, mimeType, base64: buffer.toString("base64") };
}
