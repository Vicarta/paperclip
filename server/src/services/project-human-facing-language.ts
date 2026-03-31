import type { ProjectHumanFacingLanguage } from "@paperclipai/shared";

export function normalizeProjectHumanFacingLanguage(
  value: unknown,
): ProjectHumanFacingLanguage | null {
  if (value !== "uk" && value !== "en") return null;
  return value;
}

export function buildProjectHumanFacingLanguageInstruction(
  language: ProjectHumanFacingLanguage | null | undefined,
): string | null {
  if (!language) return null;
  if (language === "uk") {
    return "For human-facing communication in this project, default to Ukrainian unless the current issue explicitly requires another language. This applies to issue comments, clarification comments, manager summaries, and direct replies to humans. It does not automatically change artifact language.";
  }
  return "For human-facing communication in this project, default to English unless the current issue explicitly requires another language. This applies to issue comments, clarification comments, manager summaries, and direct replies to humans. It does not automatically change artifact language.";
}
