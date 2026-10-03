/**
 * App Brief History & Local State Management Store
 * Provides persistent local state, rich CRUD, search/filtering, revision history,
 * cross-component reactive events, and instant revisit capabilities.
 */

export interface BriefRevision {
  timestamp: number;
  description: string;
  wordCount: number;
  charCount: number;
  note?: string;
}

export interface AppBriefRecord {
  id: string;
  title: string;
  description: string;
  wordCount: number;
  charCount: number;
  constraintMode: string;
  targetLimit: number;
  tone: string;
  source: string; // e.g. "Interactive Pitch Studio", "Bulk Generator", "AI Copilot", "Quick Prompt"
  keyPropositions: string[];
  category?: string;
  tags?: string[];
  timestamp: number;
  savedAtFormatted?: string;
  originalInput?: string;
  isFavorite?: boolean;
  isApplied?: boolean;
  rating?: number; // 1-5 stars
  revisions?: BriefRevision[];
}

export const APP_BRIEF_STORAGE_KEY = "app_briefs_history_vault_v2";
export const BRIEF_HISTORY_CHANGE_EVENT = "sightline_app_briefs_history_change";

// Initial baseline presets to seed if storage is empty
export const DEFAULT_BASELINE_BRIEFS: AppBriefRecord[] = [
  {
    id: "brief_baseline_game_vision",
    title: "AI Game Vision & Autonomous Mouse Hub",
    description:
      "Unified AI automation master platform and game vision control hub with autonomous screen perception, real PyAutoGUI mouse movements, and master workflow orchestrator.",
    wordCount: 22,
    charCount: 168,
    constraintMode: "standard_pitch",
    targetLimit: 25,
    tone: "high-impact",
    source: "Interactive Pitch Studio",
    keyPropositions: [
      "Autonomous Screen Perception",
      "PyAutoGUI Hardware Automator",
      "Master Workflow Orchestrator",
      "Real-time Drift Recalibration",
    ],
    category: "AI & Autonomous Vision",
    tags: ["gaming", "vision", "pyautogui", "orchestration"],
    timestamp: Date.now() - 86400000 * 2,
    savedAtFormatted: "2 days ago",
    originalInput:
      "This is a unified AI automation master platform and game vision control hub with autonomous screen perception, real pyautogui mouse movements, and master workflow orchestrator for cross-platform desktop and mobile games.",
    isFavorite: true,
    isApplied: true,
    rating: 5,
    revisions: [],
  },
  {
    id: "brief_baseline_twitter_brevity",
    title: "Twitter / X Brevity Micro-Pitch",
    description:
      "Autonomous AI game vision hub with real pyautogui mouse execution and workflow orchestration.",
    wordCount: 13,
    charCount: 95,
    constraintMode: "twitter_brevity",
    targetLimit: 12,
    tone: "high-impact",
    source: "Interactive Pitch Studio",
    keyPropositions: ["Autonomous Vision", "PyAutoGUI Execution", "Workflow Orchestrator"],
    category: "AI & Autonomous Vision",
    tags: ["social", "x", "brevity", "micro-pitch"],
    timestamp: Date.now() - 86400000,
    savedAtFormatted: "Yesterday",
    originalInput:
      "Autonomous AI game vision hub with real pyautogui mouse execution and workflow orchestration.",
    isFavorite: true,
    isApplied: false,
    rating: 5,
    revisions: [],
  },
  {
    id: "brief_baseline_appstore_short",
    title: "Mobile Connect & Telepresence Store Pitch",
    description:
      "Autonomous AI master automation and computer vision hub. Features deep screen perception, natural human drift mouse execution, and adaptive multi-task workflow orchestration across desktop and mobile apps.",
    wordCount: 28,
    charCount: 212,
    constraintMode: "app_store_short",
    targetLimit: 30,
    tone: "technical",
    source: "Interactive Pitch Studio",
    keyPropositions: ["Deep Screen Perception", "Human Drift Execution", "Multi-Task Orchestration"],
    category: "Mobile & Telepresence",
    tags: ["appstore", "telepresence", "mobile", "ios-android"],
    timestamp: Date.now() - 3600000 * 5,
    savedAtFormatted: "5 hours ago",
    originalInput:
      "Autonomous AI master automation and computer vision hub with screen perception, drift execution, and workflow orchestration.",
    isFavorite: false,
    isApplied: false,
    rating: 4,
    revisions: [],
  },
  {
    id: "brief_baseline_cloud_cluster",
    title: "Cloud Observability & Cluster Triager",
    description:
      "Automated Kubernetes cluster monitor and distributed trace explorer that detects anomalies and dispatches self-healing remediation routines.",
    wordCount: 17,
    charCount: 138,
    constraintMode: "standard_pitch",
    targetLimit: 20,
    tone: "technical",
    source: "Bulk Generator",
    keyPropositions: ["Kubernetes Auto-Scaler", "Distributed Trace Explorer", "Incident Triager"],
    category: "Cloud & DevOps Observability",
    tags: ["devops", "cloud", "kubernetes", "self-healing"],
    timestamp: Date.now() - 3600000 * 2,
    savedAtFormatted: "2 hours ago",
    originalInput: "Cloud cluster monitoring and self healing automation tool",
    isFavorite: false,
    isApplied: false,
    rating: 4,
    revisions: [],
  },
  {
    id: "brief_baseline_tagline",
    title: "Hero Tagline Punch",
    description: "Autonomous game vision control hub.",
    wordCount: 5,
    charCount: 36,
    constraintMode: "tagline",
    targetLimit: 6,
    tone: "minimalist",
    source: "Interactive Pitch Studio",
    keyPropositions: ["Autonomous Vision", "Game Automation"],
    category: "Brand & Identity",
    tags: ["tagline", "brand", "hero"],
    timestamp: Date.now() - 1800000,
    savedAtFormatted: "30 mins ago",
    originalInput: "Autonomous game vision control hub.",
    isFavorite: true,
    isApplied: false,
    rating: 5,
    revisions: [],
  },
];

/**
 * Reads all briefs from LocalStorage with fallback seeding.
 */
export function getStoredAppBriefs(): AppBriefRecord[] {
  if (typeof window === "undefined") return DEFAULT_BASELINE_BRIEFS;
  try {
    const raw = localStorage.getItem(APP_BRIEF_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(APP_BRIEF_STORAGE_KEY, JSON.stringify(DEFAULT_BASELINE_BRIEFS));
      return DEFAULT_BASELINE_BRIEFS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_BASELINE_BRIEFS;
  } catch (err) {
    console.warn("Failed to load app briefs from localStorage:", err);
    return DEFAULT_BASELINE_BRIEFS;
  }
}

/**
 * Writes briefs to LocalStorage and triggers cross-component event notifications.
 */
export function persistAppBriefs(briefs: AppBriefRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APP_BRIEF_STORAGE_KEY, JSON.stringify(briefs));
    window.dispatchEvent(
      new CustomEvent(BRIEF_HISTORY_CHANGE_EVENT, {
        detail: { count: briefs.length, latest: briefs[0] },
      })
    );
  } catch (err) {
    console.error("Failed persisting app briefs history:", err);
  }
}

/**
 * Saves or updates a brief in history.
 * If a brief with the exact same description already exists, it updates its metadata and timestamp.
 */
export function saveAppBrief(
  briefInput: Omit<AppBriefRecord, "id" | "timestamp"> & { id?: string; timestamp?: number }
): AppBriefRecord {
  const current = getStoredAppBriefs();
  const descTrimmed = briefInput.description.trim();

  // Find existing duplicate or match by ID
  const existingIndex = current.findIndex(
    (b) => (briefInput.id && b.id === briefInput.id) || b.description.trim().toLowerCase() === descTrimmed.toLowerCase()
  );

  const now = Date.now();
  let savedRecord: AppBriefRecord;

  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    // Record revision if description changed
    const revisions = existing.revisions ? [...existing.revisions] : [];
    if (existing.description.trim() !== descTrimmed) {
      revisions.unshift({
        timestamp: existing.timestamp,
        description: existing.description,
        wordCount: existing.wordCount,
        charCount: existing.charCount,
        note: `Updated from ${existing.wordCount} words to ${briefInput.wordCount} words`,
      });
    }

    savedRecord = {
      ...existing,
      ...briefInput,
      id: existing.id,
      timestamp: now,
      savedAtFormatted: new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
      revisions: revisions.slice(0, 10),
    };
    current[existingIndex] = savedRecord;
  } else {
    savedRecord = {
      id: briefInput.id || `brief_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: briefInput.title || "Generated App Brief",
      description: briefInput.description,
      wordCount: briefInput.wordCount,
      charCount: briefInput.charCount || briefInput.description.length,
      constraintMode: briefInput.constraintMode || "twitter_brevity",
      targetLimit: briefInput.targetLimit || 20,
      tone: briefInput.tone || "high-impact",
      source: briefInput.source || "Interactive Pitch Studio",
      keyPropositions: briefInput.keyPropositions || [],
      category: briefInput.category || "General",
      tags: briefInput.tags || [],
      timestamp: now,
      savedAtFormatted: new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
      originalInput: briefInput.originalInput,
      isFavorite: briefInput.isFavorite || false,
      isApplied: briefInput.isApplied || false,
      rating: briefInput.rating || 5,
      revisions: [],
    };
    current.unshift(savedRecord);
  }

  // Cap history at 150 items to keep localStorage fast
  const trimmed = current.slice(0, 150);
  persistAppBriefs(trimmed);
  return savedRecord;
}

/**
 * Bulk save multiple generated briefs (e.g. from Bulk Keyword Generator)
 */
export function bulkSaveAppBriefs(
  items: Array<Omit<AppBriefRecord, "id" | "timestamp"> & { id?: string; timestamp?: number }>
): AppBriefRecord[] {
  const current = getStoredAppBriefs();
  const now = Date.now();
  const added: AppBriefRecord[] = [];

  for (const item of items) {
    const descTrimmed = item.description.trim();
    const existingIndex = current.findIndex(
      (b) => (item.id && b.id === item.id) || b.description.trim().toLowerCase() === descTrimmed.toLowerCase()
    );

    if (existingIndex >= 0) {
      current[existingIndex] = {
        ...current[existingIndex],
        ...item,
        timestamp: now,
        savedAtFormatted: "Just now",
      };
      added.push(current[existingIndex]);
    } else {
      const record: AppBriefRecord = {
        id: item.id || `brief_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: item.title || "Bulk Generated Pitch",
        description: item.description,
        wordCount: item.wordCount,
        charCount: item.charCount || item.description.length,
        constraintMode: item.constraintMode || "twitter_brevity",
        targetLimit: item.targetLimit || 20,
        tone: item.tone || "high-impact",
        source: item.source || "Bulk Generator",
        keyPropositions: item.keyPropositions || [],
        category: item.category || "Bulk Generation",
        tags: item.tags || ["bulk-generated"],
        timestamp: now,
        savedAtFormatted: "Just now",
        originalInput: item.originalInput,
        isFavorite: false,
        isApplied: false,
        rating: 4,
        revisions: [],
      };
      current.unshift(record);
      added.push(record);
    }
  }

  persistAppBriefs(current.slice(0, 150));
  return added;
}

/**
 * Deletes a brief by ID
 */
export function deleteAppBrief(id: string): boolean {
  const current = getStoredAppBriefs();
  const filtered = current.filter((b) => b.id !== id);
  if (filtered.length !== current.length) {
    persistAppBriefs(filtered);
    return true;
  }
  return false;
}

/**
 * Clears all briefs (resets to empty or baseline)
 */
export function clearAppBriefsHistory(restoreDefaults = false): void {
  const next = restoreDefaults ? DEFAULT_BASELINE_BRIEFS : [];
  persistAppBriefs(next);
}

/**
 * Toggles favorite state of a brief
 */
export function toggleBriefFavorite(id: string): boolean {
  const current = getStoredAppBriefs();
  const target = current.find((b) => b.id === id);
  if (target) {
    target.isFavorite = !target.isFavorite;
    persistAppBriefs(current);
    return target.isFavorite;
  }
  return false;
}

/**
 * Updates active applied brief flag across history
 */
export function setBriefActiveApplied(id: string): void {
  const current = getStoredAppBriefs();
  current.forEach((b) => {
    b.isApplied = b.id === id;
  });
  persistAppBriefs(current);
}

/**
 * Updates ratings (1-5)
 */
export function setBriefRating(id: string, rating: number): void {
  const current = getStoredAppBriefs();
  const target = current.find((b) => b.id === id);
  if (target) {
    target.rating = Math.max(1, Math.min(5, rating));
    persistAppBriefs(current);
  }
}

/**
 * Export history as JSON
 */
export function exportBriefsToJSON(briefs: AppBriefRecord[] = getStoredAppBriefs()): void {
  const jsonStr = JSON.stringify(briefs, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `app-briefs-history-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export history as CSV
 */
export function exportBriefsToCSV(briefs: AppBriefRecord[] = getStoredAppBriefs()): void {
  if (briefs.length === 0) return;
  const headers = [
    "ID",
    "Title",
    "Description",
    "WordCount",
    "CharCount",
    "ConstraintMode",
    "TargetLimit",
    "Tone",
    "Source",
    "Category",
    "Favorite",
    "KeyPropositions",
    "Date",
  ];
  const rows = briefs.map((b) => [
    `"${b.id}"`,
    `"${b.title.replace(/"/g, '""')}"`,
    `"${b.description.replace(/"/g, '""')}"`,
    b.wordCount,
    b.charCount,
    `"${b.constraintMode}"`,
    b.targetLimit,
    `"${b.tone}"`,
    `"${b.source}"`,
    `"${b.category || ""}"`,
    b.isFavorite ? "YES" : "NO",
    `"${(b.keyPropositions || []).join(" | ").replace(/"/g, '""')}"`,
    `"${new Date(b.timestamp).toISOString()}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `app-briefs-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export history as clean Markdown document
 */
export function exportBriefsToMarkdown(briefs: AppBriefRecord[] = getStoredAppBriefs()): void {
  if (briefs.length === 0) return;
  let md = `# App Briefs & Pitches Library\n\n`;
  md += `Exported: ${new Date().toLocaleString()}\n`;
  md += `Total Briefs: ${briefs.length}\n\n---\n\n`;

  briefs.forEach((b, idx) => {
    md += `## ${idx + 1}. ${b.title}\n\n`;
    md += `> "${b.description}"\n\n`;
    md += `- **Word Count:** ${b.wordCount} words (Target: ≤ ${b.targetLimit})\n`;
    md += `- **Character Count:** ${b.charCount} chars\n`;
    md += `- **Constraint Format:** \`${b.constraintMode}\`\n`;
    md += `- **Tone/Style:** ${b.tone}\n`;
    md += `- **Source:** ${b.source}\n`;
    if (b.category) md += `- **Category:** ${b.category}\n`;
    if (b.keyPropositions && b.keyPropositions.length > 0) {
      md += `- **Key Propositions:**\n`;
      b.keyPropositions.forEach((p) => {
        md += `  - ${p}\n`;
      });
    }
    if (b.originalInput) {
      md += `\n*Original Prompt:* ${b.originalInput}\n`;
    }
    md += `\n---\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `app-briefs-library-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import briefs from JSON text with validation
 */
export function importBriefsFromJSON(jsonString: string): { success: boolean; count?: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      return { success: false, error: "Invalid format: Expected a JSON array of briefs." };
    }
    const current = getStoredAppBriefs();
    let importedCount = 0;

    for (const item of parsed) {
      if (item && typeof item.description === "string" && item.description.trim()) {
        const descTrimmed = item.description.trim();
        const existingIdx = current.findIndex((b) => b.description.trim().toLowerCase() === descTrimmed.toLowerCase());
        const record: AppBriefRecord = {
          id: item.id || `brief_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: item.title || "Imported Brief",
          description: descTrimmed,
          wordCount: item.wordCount || descTrimmed.split(/\s+/).filter(Boolean).length,
          charCount: item.charCount || descTrimmed.length,
          constraintMode: item.constraintMode || "twitter_brevity",
          targetLimit: item.targetLimit || 20,
          tone: item.tone || "high-impact",
          source: item.source || "JSON Import",
          keyPropositions: Array.isArray(item.keyPropositions) ? item.keyPropositions : [],
          category: item.category || "Imported",
          tags: Array.isArray(item.tags) ? item.tags : ["imported"],
          timestamp: typeof item.timestamp === "number" ? item.timestamp : Date.now(),
          savedAtFormatted: new Date().toLocaleDateString(),
          originalInput: item.originalInput,
          isFavorite: Boolean(item.isFavorite),
          isApplied: false,
          rating: item.rating || 5,
          revisions: Array.isArray(item.revisions) ? item.revisions : [],
        };

        if (existingIdx >= 0) {
          current[existingIdx] = record;
        } else {
          current.unshift(record);
        }
        importedCount++;
      }
    }

    persistAppBriefs(current.slice(0, 150));
    return { success: true, count: importedCount };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to parse JSON file." };
  }
}
