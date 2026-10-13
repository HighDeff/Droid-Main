import React from "react";
import {
  Share2,
  Smartphone,
  Zap,
  FileText,
  Layers,
  SlidersHorizontal,
  LucideIcon,
} from "lucide-react";

export type WordConstraintMode =
  | "twitter_brevity"
  | "app_store_short"
  | "tagline"
  | "standard_pitch"
  | "detailed_store"
  | "custom";

export interface ConstraintPresetConfig {
  id: WordConstraintMode;
  label: string;
  shortName: string;
  defaultWords: number;
  maxWords: number;
  maxCharsEstimate: number;
  platformGuideline: string;
  icon: LucideIcon;
  color: string;
  bgActive: string;
  borderActive: string;
  textActive: string;
  badge: string;
  tooltip: string;
}

export const CONSTRAINT_PRESETS: ConstraintPresetConfig[] = [
  {
    id: "twitter_brevity",
    label: "Twitter / X Brevity",
    shortName: "Twitter / X",
    defaultWords: 12,
    maxWords: 12,
    maxCharsEstimate: 100,
    platformGuideline:
      "Twitter/X post brevity: ultra-compact, punchy hook fitting under 100-140 characters for immediate social engagement.",
    icon: Share2,
    color: "cyan",
    bgActive: "bg-cyan-950/90",
    borderActive: "border-cyan-500",
    textActive: "text-cyan-300",
    badge: "≤ 12 words (~100 chars)",
    tooltip:
      "Micro-pitch optimized for social media posts, tweet previews, and notification cards.",
  },
  {
    id: "app_store_short",
    label: "App Store Short Description",
    shortName: "App Store",
    defaultWords: 30,
    maxWords: 30,
    maxCharsEstimate: 255,
    platformGuideline:
      "App Store & Google Play short promo length: strict 170-255 char limit, highlights core features and user benefits.",
    icon: Smartphone,
    color: "blue",
    bgActive: "bg-blue-950/90",
    borderActive: "border-blue-500",
    textActive: "text-blue-300",
    badge: "≤ 30 words (170-255 chars)",
    tooltip:
      "Complies with Apple App Store subtitle/promo text and Google Play Store 80-255 character short description standards.",
  },
  {
    id: "tagline",
    label: "Punchy Tagline",
    shortName: "Tagline",
    defaultWords: 6,
    maxWords: 6,
    maxCharsEstimate: 50,
    platformGuideline:
      "Ultra-condensed hero headline: 4 to 6 words delivering a memorable, instant brand identity.",
    icon: Zap,
    color: "amber",
    bgActive: "bg-amber-950/90",
    borderActive: "border-amber-500",
    textActive: "text-amber-300",
    badge: "≤ 6 words (Hero Tagline)",
    tooltip:
      "Bold headline hook for landing page hero sections, navigation bars, and app badges.",
  },
  {
    id: "standard_pitch",
    label: "Standard Pitch Deck",
    shortName: "Elevator Pitch",
    defaultWords: 18,
    maxWords: 18,
    maxCharsEstimate: 140,
    platformGuideline:
      "Classic elevator pitch: 15-18 words, balanced clarity highlighting core problem and technology.",
    icon: FileText,
    color: "emerald",
    bgActive: "bg-emerald-950/90",
    borderActive: "border-emerald-500",
    textActive: "text-emerald-300",
    badge: "≤ 18 words (Pitch Deck)",
    tooltip:
      "Balanced concise product summary for product cards, GitHub README headers, and pitch decks.",
  },
  {
    id: "detailed_store",
    label: "Full Store Overview",
    shortName: "Full Overview",
    defaultWords: 50,
    maxWords: 50,
    maxCharsEstimate: 400,
    platformGuideline:
      "Comprehensive store description: up to 50 words detailing multi-module architecture and key capabilities.",
    icon: Layers,
    color: "purple",
    bgActive: "bg-purple-950/90",
    borderActive: "border-purple-500",
    textActive: "text-purple-300",
    badge: "≤ 50 words (Overview)",
    tooltip:
      "Rich paragraph covering feature breakdown, automated capabilities, and platform support.",
  },
  {
    id: "custom",
    label: "Custom Constraint",
    shortName: "Custom",
    defaultWords: 24,
    maxWords: 80,
    maxCharsEstimate: 600,
    platformGuideline:
      "User-defined word count and character limits for tailored publishing constraints.",
    icon: SlidersHorizontal,
    color: "pink",
    bgActive: "bg-pink-950/90",
    borderActive: "border-pink-500",
    textActive: "text-pink-300",
    badge: "User Defined",
    tooltip: "Custom slider and number stepper from 4 to 80 words.",
  },
];
