import { describe, expect, it } from "vitest";
import {
  buildProjectHumanFacingLanguageInstruction,
  normalizeProjectHumanFacingLanguage,
} from "../services/project-human-facing-language.js";

describe("normalizeProjectHumanFacingLanguage", () => {
  it("accepts supported V1 language codes", () => {
    expect(normalizeProjectHumanFacingLanguage("uk")).toBe("uk");
    expect(normalizeProjectHumanFacingLanguage("en")).toBe("en");
  });

  it("returns null for unsupported values", () => {
    expect(normalizeProjectHumanFacingLanguage("de")).toBeNull();
    expect(normalizeProjectHumanFacingLanguage(null)).toBeNull();
  });
});

describe("buildProjectHumanFacingLanguageInstruction", () => {
  it("builds a narrow human-facing instruction for Ukrainian", () => {
    expect(buildProjectHumanFacingLanguageInstruction("uk")).toContain("default to Ukrainian");
    expect(buildProjectHumanFacingLanguageInstruction("uk")).toContain("does not automatically change artifact language");
  });

  it("builds a narrow human-facing instruction for English", () => {
    expect(buildProjectHumanFacingLanguageInstruction("en")).toContain("default to English");
  });
});
