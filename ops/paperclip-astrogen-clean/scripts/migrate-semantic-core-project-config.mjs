#!/usr/bin/env node
import { chmod, readFile, rename, writeFile } from "node:fs/promises";

const [configPath] = process.argv.slice(2);
if (!configPath) throw new Error("Usage: migrate-semantic-core-project-config.mjs <project-config.json>");

const raw = await readFile(configPath, "utf8");
const config = JSON.parse(raw);
if (!config || typeof config !== "object" || Array.isArray(config)) {
  throw new Error("Project config must be a JSON object");
}

const legacy = {
  clientKey: typeof config.client_key === "string" ? config.client_key.trim() : "",
  country: typeof config.country === "string" ? config.country.trim() : "",
  language: typeof config.language === "string" ? config.language.trim() : "",
  siteDomain: typeof config.site_domain === "string" ? config.site_domain.trim() : "",
};

if (!config.site_id && legacy.clientKey) config.site_id = legacy.clientKey;
if (!config.domain && legacy.siteDomain) config.domain = legacy.siteDomain;
if ((!Array.isArray(config.locale_matrix) || config.locale_matrix.length === 0) && legacy.language) {
  throw new Error("Cannot infer location_code safely from legacy country/language; provide locale_matrix explicitly");
}

for (const key of ["client_key", "country", "language", "site_domain"]) delete config[key];

for (const key of ["site_id", "domain", "locale_matrix", "sections", "owner_rules", "thresholds", "title_meta_policy"]) {
  const value = config[key];
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    throw new Error(`Required canonical project config field is missing: ${key}`);
  }
}

const temporaryPath = `${configPath}.next`;
await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
await chmod(temporaryPath, 0o600);
await rename(temporaryPath, configPath);

process.stdout.write(`${JSON.stringify({
  ok: true,
  migratedLegacyKeys: Object.entries(legacy).filter(([, value]) => value).map(([key]) => key),
  siteIdPresent: Boolean(config.site_id),
  domainPresent: Boolean(config.domain),
  localeCount: config.locale_matrix.length,
  sectionCount: config.sections.length,
}, null, 2)}\n`);
