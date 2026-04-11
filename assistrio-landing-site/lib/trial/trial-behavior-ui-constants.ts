/**
 * Behavior UI labels aligned with `ai-platform-app` `botFormUiConstants` (trial playground).
 */

export const TRIAL_BEHAVIOR_TAB_META = {
  title: "Tone & instructions",
  description:
    "Personality presets, system behavior, and lead capture for your trial agent. This mirrors the main product Behavior tab.",
} as const;

/** Preset keys must stay compatible with backend `coerceBehaviorPreset` / bot schema. */
export const TRIAL_BEHAVIOR_PRESETS = [
  { value: "default", label: "Default helper" },
  { value: "support", label: "Support agent" },
  { value: "sales", label: "Sales assistant" },
  { value: "technical", label: "Technical assistant" },
  { value: "marketing", label: "Marketing assistant" },
  { value: "consultative", label: "Consultative advisor" },
  { value: "teacher", label: "Teacher and explainer" },
  { value: "empathetic", label: "Empathetic listener" },
  { value: "strict", label: "Strict policy-based" },
] as const;

export const TRIAL_BEHAVIOR_TONES = [
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "playful", label: "Playful" },
  { value: "technical", label: "Technical" },
] as const;

/** Match authenticated Behavior section suggested-question cap. */
export const TRIAL_BEHAVIOR_EXAMPLE_QUESTIONS_MAX = 5;
