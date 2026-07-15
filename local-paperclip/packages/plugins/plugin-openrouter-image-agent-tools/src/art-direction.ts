export const HUMAN_EMOTIONAL_BEATS = [
  "anticipation",
  "concern",
  "connection",
  "curiosity",
  "discovery",
  "hope",
  "recognition",
  "reassurance",
  "relief",
  "resolve",
  "surprise",
  "tenderness",
  "trust",
  "uncertainty",
] as const;

export const HUMAN_SCENE_ARCHETYPES = [
  "active_conversation",
  "decision_point",
  "discovery_moment",
  "expert_listening",
  "family_interaction",
  "personal_reflection",
  "post_consultation_relief",
  "relationship_exchange",
  "transition_in_motion",
] as const;

export const HUMAN_ACTION_TYPES = [
  "choosing",
  "comforting",
  "deciding",
  "discovering",
  "discussing",
  "embracing",
  "listening",
  "pausing",
  "preparing",
  "reacting",
  "walking",
] as const;

export const HUMAN_SUBJECT_ARRANGEMENTS = [
  "couple",
  "couple_with_expert",
  "family_group",
  "one_person",
  "person_with_expert",
  "two_people",
] as const;

export const HUMAN_SHOT_DISTANCES = [
  "close_up",
  "medium",
  "over_shoulder",
  "wide_environmental",
] as const;

export const HUMAN_CAMERA_ANGLES = [
  "eye_level",
  "high_angle",
  "low_angle",
  "profile",
  "three_quarter",
] as const;

export const HUMAN_GAZE_PLANS = [
  "at_another_person",
  "at_meaningful_object",
  "off_camera_action",
  "viewer_facing_moment",
] as const;

export const HUMAN_ART_DIRECTION_SCHEMA = {
  type: "object",
  properties: {
    narrativeMoment: { type: "string" },
    sceneArchetype: { type: "string", enum: HUMAN_SCENE_ARCHETYPES },
    setting: { type: "string" },
    subjectArrangement: { type: "string", enum: HUMAN_SUBJECT_ARRANGEMENTS },
    actionType: { type: "string", enum: HUMAN_ACTION_TYPES },
    actionDescription: { type: "string" },
    emotion: {
      type: "object",
      properties: {
        primary: { type: "string", enum: HUMAN_EMOTIONAL_BEATS },
        intensity: { type: "string", enum: ["subtle", "moderate", "strong_controlled"] },
        visibleCues: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
      },
      required: ["primary", "intensity", "visibleCues"],
    },
    composition: {
      type: "object",
      properties: {
        shotDistance: { type: "string", enum: HUMAN_SHOT_DISTANCES },
        cameraAngle: { type: "string", enum: HUMAN_CAMERA_ANGLES },
        gazePlan: { type: "string", enum: HUMAN_GAZE_PLANS },
      },
      required: ["shotDistance", "cameraAngle", "gazePlan"],
    },
    dominantProps: { type: "array", items: { type: "string" }, maxItems: 5 },
    brandAnchors: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    avoidVisualPatterns: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
  },
  required: [
    "narrativeMoment",
    "sceneArchetype",
    "setting",
    "subjectArrangement",
    "actionType",
    "actionDescription",
    "emotion",
    "composition",
    "dominantProps",
    "brandAnchors",
    "avoidVisualPatterns",
  ],
} as const;

type HumanEmotionalBeat = typeof HUMAN_EMOTIONAL_BEATS[number];
type HumanSceneArchetype = typeof HUMAN_SCENE_ARCHETYPES[number];
type HumanActionType = typeof HUMAN_ACTION_TYPES[number];
type HumanSubjectArrangement = typeof HUMAN_SUBJECT_ARRANGEMENTS[number];
type HumanShotDistance = typeof HUMAN_SHOT_DISTANCES[number];
type HumanCameraAngle = typeof HUMAN_CAMERA_ANGLES[number];
type HumanGazePlan = typeof HUMAN_GAZE_PLANS[number];

export type HumanArtDirection = {
  narrativeMoment: string;
  sceneArchetype: HumanSceneArchetype;
  setting: string;
  subjectArrangement: HumanSubjectArrangement;
  actionType: HumanActionType;
  actionDescription: string;
  emotion: {
    primary: HumanEmotionalBeat;
    intensity: "subtle" | "moderate" | "strong_controlled";
    visibleCues: string[];
  };
  composition: {
    shotDistance: HumanShotDistance;
    cameraAngle: HumanCameraAngle;
    gazePlan: HumanGazePlan;
  };
  dominantProps: string[];
  brandAnchors: string[];
  avoidVisualPatterns: string[];
};

export type HumanVisualFingerprint = {
  sceneArchetype: HumanSceneArchetype;
  setting: string;
  subjectArrangement: HumanSubjectArrangement;
  actionType: HumanActionType;
  emotionalBeat: HumanEmotionalBeat;
  gazePlan: HumanGazePlan;
  shotDistance: HumanShotDistance;
  cameraAngle: HumanCameraAngle;
  dominantProps: string[];
};

export type HumanVisualHistoryEntry = {
  articleKey: string;
  generatedAt: string;
  fingerprint: HumanVisualFingerprint;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredString(record: Record<string, unknown>, key: string, prefix: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${prefix}.${key} is required`);
  return value.trim();
}

function enumValue<T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
  prefix: string,
): T[number] {
  const value = requiredString(record, key, prefix);
  if (!allowed.includes(value)) {
    throw new Error(`${prefix}.${key} must be one of: ${allowed.join(", ")}`);
  }
  return value as T[number];
}

function stringArray(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
  options: { min: number; max: number },
) {
  const value = record[key];
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
  if (items.length < options.min || items.length > options.max) {
    throw new Error(`${prefix}.${key} must contain ${options.min}-${options.max} items`);
  }
  return items;
}

export function parseHumanArtDirection(value: unknown): HumanArtDirection {
  const record = recordValue(value);
  const emotion = recordValue(record.emotion);
  const composition = recordValue(record.composition);
  return {
    narrativeMoment: requiredString(record, "narrativeMoment", "artDirection"),
    sceneArchetype: enumValue(record, "sceneArchetype", HUMAN_SCENE_ARCHETYPES, "artDirection"),
    setting: requiredString(record, "setting", "artDirection"),
    subjectArrangement: enumValue(record, "subjectArrangement", HUMAN_SUBJECT_ARRANGEMENTS, "artDirection"),
    actionType: enumValue(record, "actionType", HUMAN_ACTION_TYPES, "artDirection"),
    actionDescription: requiredString(record, "actionDescription", "artDirection"),
    emotion: {
      primary: enumValue(emotion, "primary", HUMAN_EMOTIONAL_BEATS, "artDirection.emotion"),
      intensity: enumValue(
        emotion,
        "intensity",
        ["subtle", "moderate", "strong_controlled"] as const,
        "artDirection.emotion",
      ),
      visibleCues: stringArray(emotion, "visibleCues", "artDirection.emotion", { min: 2, max: 5 }),
    },
    composition: {
      shotDistance: enumValue(composition, "shotDistance", HUMAN_SHOT_DISTANCES, "artDirection.composition"),
      cameraAngle: enumValue(composition, "cameraAngle", HUMAN_CAMERA_ANGLES, "artDirection.composition"),
      gazePlan: enumValue(composition, "gazePlan", HUMAN_GAZE_PLANS, "artDirection.composition"),
    },
    dominantProps: stringArray(record, "dominantProps", "artDirection", { min: 0, max: 5 }),
    brandAnchors: stringArray(record, "brandAnchors", "artDirection", { min: 2, max: 5 }),
    avoidVisualPatterns: stringArray(record, "avoidVisualPatterns", "artDirection", { min: 1, max: 8 }),
  };
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function fingerprintFor(direction: HumanArtDirection): HumanVisualFingerprint {
  return {
    sceneArchetype: direction.sceneArchetype,
    setting: normalized(direction.setting),
    subjectArrangement: direction.subjectArrangement,
    actionType: direction.actionType,
    emotionalBeat: direction.emotion.primary,
    gazePlan: direction.composition.gazePlan,
    shotDistance: direction.composition.shotDistance,
    cameraAngle: direction.composition.cameraAngle,
    dominantProps: [...new Set(direction.dominantProps.map(normalized))].sort(),
  };
}

function propSetsMatch(left: string[], right: string[]) {
  if (!left.length && !right.length) return true;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  return intersection / Math.max(leftSet.size, rightSet.size) >= 0.6;
}

export function compareFingerprint(left: HumanVisualFingerprint, right: HumanVisualFingerprint) {
  const comparisons = [
    ["sceneArchetype", left.sceneArchetype === right.sceneArchetype],
    ["setting", left.setting === right.setting],
    ["subjectArrangement", left.subjectArrangement === right.subjectArrangement],
    ["actionType", left.actionType === right.actionType],
    ["emotionalBeat", left.emotionalBeat === right.emotionalBeat],
    ["gazePlan", left.gazePlan === right.gazePlan],
    ["shotDistance", left.shotDistance === right.shotDistance],
    ["cameraAngle", left.cameraAngle === right.cameraAngle],
    ["dominantProps", propSetsMatch(left.dominantProps, right.dominantProps)],
  ] as const;
  const matchingAxes = comparisons.filter(([, matches]) => matches).map(([axis]) => axis);
  return {
    matchingAxes,
    distinctAxisCount: comparisons.length - matchingAxes.length,
    totalAxisCount: comparisons.length,
  };
}

export function buildGovernedHumanPrompt(input: {
  prompt: string;
  direction: HumanArtDirection;
  legacyAvoidPatterns: string[];
}) {
  const direction = input.direction;
  return [
    input.prompt.trim(),
    "",
    "GOVERNED HUMAN-SCENE ART DIRECTION:",
    `Narrative moment: ${direction.narrativeMoment}`,
    `Scene: ${direction.sceneArchetype}; setting: ${direction.setting}; subjects: ${direction.subjectArrangement}.`,
    `Visible action: ${direction.actionType} — ${direction.actionDescription}`,
    `Primary emotion: ${direction.emotion.primary}, intensity ${direction.emotion.intensity}.`,
    `The emotion must be visibly readable through: ${direction.emotion.visibleCues.join("; ")}.`,
    `Composition: ${direction.composition.shotDistance}, ${direction.composition.cameraAngle}, gaze ${direction.composition.gazePlan}.`,
    `Dominant props only if narratively useful: ${direction.dominantProps.join(", ") || "none"}.`,
    `Astrogen brand anchors: ${direction.brandAnchors.join("; ")}. Treat burgundy and gold as restrained accents, not a mandatory sweater, room, or tabletop formula.`,
    `Avoid for this image: ${[...direction.avoidVisualPatterns, ...input.legacyAvoidPatterns].join("; ")}.`,
    "The person must not have a blank neutral catalogue expression. Preserve natural anatomy and premium editorial realism without glossy stock-photo perfection or melodrama.",
  ].join("\n");
}
