#!/usr/bin/env node
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const envPath = process.env.PAPERCLIP_ENV_PATH ?? "/home/paperclip/apps/paperclip-astrogen-clean/.env";
const image = process.env.PAPERCLIP_APP_IMAGE?.trim();
if (!image || !/^paperclip-app:[A-Za-z0-9._-]+$/.test(image)) {
  throw new Error("PAPERCLIP_APP_IMAGE must be a validated local paperclip-app tag");
}

const before = readFileSync(envPath, "utf8");
const pattern = /^PAPERCLIP_APP_IMAGE=.*$/m;
if (!pattern.test(before)) throw new Error(`PAPERCLIP_APP_IMAGE is missing from ${envPath}`);
const after = before.replace(pattern, `PAPERCLIP_APP_IMAGE=${image}`);
if (after === before) {
  console.log(JSON.stringify({ ok: true, changed: false, image }, null, 2));
  process.exit(0);
}

const backupPath = `${envPath}.before-${image.replaceAll(/[^A-Za-z0-9._-]/g, "-")}`;
copyFileSync(envPath, backupPath, 0);
writeFileSync(envPath, after, { mode: 0o600 });
const verified = readFileSync(envPath, "utf8");
if (!verified.includes(`PAPERCLIP_APP_IMAGE=${image}`)) {
  throw new Error("Image tag verification failed");
}
console.log(JSON.stringify({ ok: true, changed: true, image, backupPath }, null, 2));
