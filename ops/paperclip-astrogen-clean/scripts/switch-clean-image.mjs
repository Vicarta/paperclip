#!/usr/bin/env node

import { chmod, copyFile, readFile, stat, writeFile } from "node:fs/promises";

const envPath = process.env.PAPERCLIP_CLEAN_ENV_PATH
  ?? "/home/paperclip/apps/paperclip-astrogen-clean/.env";
const [image, releaseTag, gitRevision, buildTime] = process.argv.slice(2);

if (!image || !releaseTag || !gitRevision || !buildTime) {
  throw new Error("Usage: switch-clean-image.mjs <image> <releaseTag> <gitRevision> <buildTime>");
}

const original = await readFile(envPath, "utf8");
const metadata = await stat(envPath);
const backupPath = `${envPath}.before-${releaseTag.replace(/[^a-zA-Z0-9_.-]/g, "-")}`;

await copyFile(envPath, backupPath);

const replacements = new Map([
  ["PAPERCLIP_APP_IMAGE", image],
  ["PAPERCLIP_RELEASE_TAG", releaseTag],
  ["PAPERCLIP_GIT_REVISION", gitRevision],
  ["PAPERCLIP_BUILD_TIME", buildTime],
]);

const seen = new Set();
const lines = original.split(/\r?\n/).map((line) => {
  const match = line.match(/^([A-Z0-9_]+)=/);
  if (!match || !replacements.has(match[1])) return line;
  seen.add(match[1]);
  return `${match[1]}=${replacements.get(match[1])}`;
});

for (const [key, value] of replacements) {
  if (!seen.has(key)) lines.push(`${key}=${value}`);
}

await writeFile(envPath, `${lines.join("\n").replace(/\n+$/, "")}\n`, { mode: metadata.mode });
await chmod(envPath, metadata.mode);

console.log(JSON.stringify({ ok: true, image, releaseTag, backupPath }));
