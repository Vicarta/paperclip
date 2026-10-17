#!/usr/bin/env node
import { chmod, readFile, rename, writeFile } from "node:fs/promises";

const [envPath, image] = process.argv.slice(2);

if (!envPath || !image) {
  throw new Error("Usage: set-compose-app-image.mjs <env-path> <image>");
}
if (!/^paperclip-app:[A-Za-z0-9._-]+$/.test(image)) {
  throw new Error("Refusing invalid Paperclip image reference");
}

const source = await readFile(envPath, "utf8");
const matches = source.match(/^PAPERCLIP_APP_IMAGE=.*$/gm) ?? [];
if (matches.length !== 1) {
  throw new Error(`Expected exactly one PAPERCLIP_APP_IMAGE binding, found ${matches.length}`);
}

const updated = source.replace(/^PAPERCLIP_APP_IMAGE=.*$/m, `PAPERCLIP_APP_IMAGE=${image}`);
const temporaryPath = `${envPath}.next`;
await writeFile(temporaryPath, updated, { encoding: "utf8", mode: 0o600 });
await chmod(temporaryPath, 0o600);
await rename(temporaryPath, envPath);
process.stdout.write(`${image}\n`);
