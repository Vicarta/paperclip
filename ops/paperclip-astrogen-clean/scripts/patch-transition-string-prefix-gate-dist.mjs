#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const [servicePath, validatorPath] = process.argv.slice(2);
if (!servicePath || !validatorPath) {
  throw new Error("Usage: patch-transition-string-prefix-gate-dist.mjs <pipelines-service.js> <pipeline-validator.js>");
}

const serviceMarker = "const invalidStringPrefixes = Object.entries(requirement.requiredStringPrefixes ?? {})";
const serviceInsertionPoint = "        const invalidSingleItemArrayMatches = Object.entries(requirement.singleItemArrayMatchesField ?? {})";
const serviceGate = `        const invalidStringPrefixes = Object.entries(requirement.requiredStringPrefixes ?? {})
            .flatMap(([key, expectedPrefix]) => {
            const actualValue = fields[key];
            return typeof actualValue === "string" && actualValue.startsWith(expectedPrefix)
                ? []
                : [{ key, expectedPrefix, actualValue: actualValue ?? null }];
        });
        if (invalidStringPrefixes.length > 0) {
            throw conflict("Pipeline case strings do not have the required prefixes for this transition", {
                code: "pipeline_case_required_string_prefix_mismatch",
                fromStageKey: fromStage.key,
                toStageKey: toStage.key,
                invalidStringPrefixes,
            });
        }
`;

const validatorMarker = "requiredStringPrefixes: z.record(";
const validatorInsertionPoint = "    singleItemArrayMatchesField: z.record(routineVariableLikeNameSchema, routineVariableLikeNameSchema).optional().default({}),";
const validatorField = `    requiredStringPrefixes: z.record(routineVariableLikeNameSchema, z.string().trim().min(1).max(500)).optional().default({}),
`;

let service = readFileSync(servicePath, "utf8");
if (!service.includes(serviceMarker)) {
  if (!service.includes(serviceInsertionPoint)) {
    throw new Error("Compiled pipelines service insertion point not found");
  }
  service = service.replace(serviceInsertionPoint, `${serviceGate}${serviceInsertionPoint}`);
  writeFileSync(servicePath, service);
}

let validator = readFileSync(validatorPath, "utf8");
if (!validator.includes(validatorMarker)) {
  if (!validator.includes(validatorInsertionPoint)) {
    throw new Error("Compiled pipeline validator insertion point not found");
  }
  validator = validator.replace(validatorInsertionPoint, `${validatorField}${validatorInsertionPoint}`);
  writeFileSync(validatorPath, validator);
}

const verifiedService = readFileSync(servicePath, "utf8");
const verifiedValidator = readFileSync(validatorPath, "utf8");
if (!verifiedService.includes(serviceMarker) || !verifiedValidator.includes(validatorMarker)) {
  throw new Error("Transition string-prefix gate verification failed");
}

console.log(JSON.stringify({
  ok: true,
  servicePath,
  validatorPath,
  status: "patched-or-already-present",
}));
