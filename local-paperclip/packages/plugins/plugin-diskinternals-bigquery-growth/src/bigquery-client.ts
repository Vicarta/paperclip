import { createSign } from "node:crypto";
import { normalizeConfig, type BigQueryGrowthPluginConfig } from "./config.js";

export type QueryParameterValue = string | number | boolean | null;

export type BigQueryQueryOptions = {
  query: string;
  parameters?: Record<string, QueryParameterValue>;
  dryRun?: boolean;
  maximumBytesBilled?: string;
};

export type BigQueryQueryResult = {
  rows: Record<string, unknown>[];
  totalRows: number;
  totalBytesProcessed: string | null;
  cacheHit: boolean | null;
  jobReference: unknown;
  dryRun: boolean;
};

type FetchFn = typeof fetch;

type ResolveSecret = (secretRef: string) => Promise<string>;

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function base64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function formEncode(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

function parseServiceAccountJson(raw: string): ServiceAccountJson {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("BigQuery service account secret must contain a JSON object");
  }
  return parsed as ServiceAccountJson;
}

async function getServiceAccountAccessToken(input: {
  serviceAccountJson: string;
  fetchFn: FetchFn;
}) {
  const serviceAccount = parseServiceAccountJson(input.serviceAccountJson);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("BigQuery service account JSON is missing client_email or private_key");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = [
    base64urlJson({ alg: "RS256", typ: "JWT" }),
    base64urlJson({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/bigquery",
      aud: tokenUri,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  ].join(".");
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .end()
    .sign(serviceAccount.private_key)
    .toString("base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await input.fetchFn(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok || !isRecord(payload) || typeof payload.access_token !== "string") {
    throw new Error(`Failed to obtain BigQuery access token: HTTP ${response.status}`);
  }
  return payload.access_token;
}

export async function resolveBigQueryAccessToken(input: {
  config: BigQueryGrowthPluginConfig;
  resolveSecret: ResolveSecret;
  fetchFn: FetchFn;
}) {
  const config = normalizeConfig(input.config);
  if (config.bigQueryAccessTokenSecretRef) {
    return (await input.resolveSecret(config.bigQueryAccessTokenSecretRef)).trim();
  }
  if (config.bigQueryServiceAccountJsonSecretRef) {
    return await getServiceAccountAccessToken({
      serviceAccountJson: await input.resolveSecret(config.bigQueryServiceAccountJsonSecretRef),
      fetchFn: input.fetchFn,
    });
  }
  throw new Error("BigQuery credential secret is not configured");
}

function inferParameterType(value: QueryParameterValue) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? "INT64" : "FLOAT64";
  }
  if (typeof value === "boolean") return "BOOL";
  return "STRING";
}

function toQueryParameters(parameters: Record<string, QueryParameterValue> = {}) {
  return Object.entries(parameters).map(([name, value]) => ({
    name,
    parameterType: { type: inferParameterType(value) },
    parameterValue: { value: value === null ? null : String(value) },
  }));
}

function decodeCell(field: { name?: string; type?: string }, cell: unknown): unknown {
  if (!isRecord(cell)) return null;
  const value = cell.v;
  if (value === null || value === undefined) return null;
  if (field.type === "INTEGER" || field.type === "INT64") return Number(value);
  if (field.type === "FLOAT" || field.type === "FLOAT64" || field.type === "NUMERIC") {
    return Number(value);
  }
  if (field.type === "BOOLEAN" || field.type === "BOOL") return value === "true" || value === true;
  return value;
}

function decodeRows(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];
  const schemaFields = isRecord(payload.schema) && Array.isArray(payload.schema.fields)
    ? payload.schema.fields.filter(isRecord)
    : [];
  const rows = Array.isArray(payload.rows) ? payload.rows.filter(isRecord) : [];
  return rows.map((row) => {
    const cells = Array.isArray(row.f) ? row.f : [];
    const out: Record<string, unknown> = {};
    schemaFields.forEach((field, index) => {
      const name = typeof field.name === "string" ? field.name : `field_${index}`;
      out[name] = decodeCell(field, cells[index]);
    });
    return out;
  });
}

export async function runBigQueryQuery(input: {
  config: BigQueryGrowthPluginConfig;
  resolveSecret: ResolveSecret;
  fetchFn: FetchFn;
  options: BigQueryQueryOptions;
}): Promise<BigQueryQueryResult> {
  const config = normalizeConfig(input.config);
  if (!config.bigQueryProjectId) {
    throw new Error("BigQuery project id is not configured");
  }
  const accessToken = await resolveBigQueryAccessToken({
    config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });
  const response = await input.fetchFn(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(config.bigQueryProjectId)}/queries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: input.options.query,
        useLegacySql: false,
        location: config.bigQueryLocation,
        dryRun: input.options.dryRun === true,
        maximumBytesBilled: input.options.maximumBytesBilled ?? config.maximumBytesBilled,
        parameterMode: "NAMED",
        queryParameters: toQueryParameters(input.options.parameters),
      }),
    },
  );
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === "object"
      ? JSON.stringify(payload.error)
      : `HTTP ${response.status}`;
    throw new Error(`BigQuery query failed: ${message}`);
  }
  if (!isRecord(payload)) {
    throw new Error("BigQuery query returned a non-object payload");
  }
  return {
    rows: decodeRows(payload),
    totalRows: typeof payload.totalRows === "string" ? Number(payload.totalRows) : 0,
    totalBytesProcessed: typeof payload.totalBytesProcessed === "string"
      ? payload.totalBytesProcessed
      : null,
    cacheHit: typeof payload.cacheHit === "boolean" ? payload.cacheHit : null,
    jobReference: payload.jobReference ?? null,
    dryRun: input.options.dryRun === true,
  };
}
