export type WordConstraintMode =
  | "elevator"
  | "executive"
  | "tweet"
  | "one_sentence"
  | "detailed"
  | "custom";

export interface ConstraintPresetConfig {
  id: WordConstraintMode;
  label: string;
  maxWords: number;
  description: string;
}

export const CONSTRAINT_PRESETS: ConstraintPresetConfig[] = [
  {
    id: "one_sentence",
    label: "One-Sentence Hook (10 words)",
    maxWords: 10,
    description: "Punchy, single-sentence summary for hero banners and ads.",
  },
  {
    id: "elevator",
    label: "Elevator Pitch (20 words)",
    maxWords: 20,
    description: "Crisp 20-word executive value proposition.",
  },
  {
    id: "executive",
    label: "Executive Brief (50 words)",
    maxWords: 50,
    description: "Comprehensive 50-word overview for stakeholders.",
  },
  {
    id: "tweet",
    label: "Social Post (30 words)",
    maxWords: 30,
    description: "Engaging social post formatted for Twitter/X and LinkedIn.",
  },
  {
    id: "detailed",
    label: "Product Overview (100 words)",
    maxWords: 100,
    description: "In-depth functional breakdown of capabilities and features.",
  },
  {
    id: "custom",
    label: "Custom Limit",
    maxWords: 25,
    description: "User-specified word count limit.",
  },
];
