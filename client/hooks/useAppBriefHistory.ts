import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AppBriefRecord,
  getStoredAppBriefs,
  saveAppBrief,
  bulkSaveAppBriefs,
  deleteAppBrief,
  clearAppBriefsHistory,
  toggleBriefFavorite,
  setBriefActiveApplied,
  setBriefRating,
  exportBriefsToJSON,
  exportBriefsToCSV,
  exportBriefsToMarkdown,
  importBriefsFromJSON,
  BRIEF_HISTORY_CHANGE_EVENT,
} from "@/lib/app-brief-history-store";
import { toast } from "sonner";

export interface UseAppBriefHistoryOptions {
  initialSearch?: string;
  initialConstraintFilter?: string;
  initialToneFilter?: string;
  initialCategoryFilter?: string;
  initialFavoritesOnly?: boolean;
}

export function useAppBriefHistory(options: UseAppBriefHistoryOptions = {}) {
  const [briefs, setBriefs] = useState<AppBriefRecord[]>(() => getStoredAppBriefs());
  const [searchQuery, setSearchQuery] = useState<string>(options.initialSearch || "");
  const [constraintFilter, setConstraintFilter] = useState<string>(options.initialConstraintFilter || "all");
  const [toneFilter, setToneFilter] = useState<string>(options.initialToneFilter || "all");
  const [categoryFilter, setCategoryFilter] = useState<string>(options.initialCategoryFilter || "all");
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(Boolean(options.initialFavoritesOnly));
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "shortest" | "longest" | "title" | "favorites">("newest");

  // Sync state across components & windows
  useEffect(() => {
    const handleStorage = () => {
      setBriefs(getStoredAppBriefs());
    };

    const handleCustomChange = () => {
      setBriefs(getStoredAppBriefs());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(BRIEF_HISTORY_CHANGE_EVENT, handleCustomChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(BRIEF_HISTORY_CHANGE_EVENT, handleCustomChange);
    };
  }, []);

  // Filtered & Sorted Briefs
  const filteredBriefs = useMemo(() => {
    return briefs
      .filter((brief) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = brief.title.toLowerCase().includes(q);
          const matchDesc = brief.description.toLowerCase().includes(q);
          const matchSource = brief.source.toLowerCase().includes(q);
          const matchCategory = brief.category?.toLowerCase().includes(q);
          const matchTags = brief.tags?.some((t) => t.toLowerCase().includes(q));
          const matchProps = brief.keyPropositions?.some((p) => p.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchSource && !matchCategory && !matchTags && !matchProps) {
            return false;
          }
        }

        // Favorites only
        if (favoritesOnly && !brief.isFavorite) {
          return false;
        }

        // Constraint filter
        if (constraintFilter !== "all" && brief.constraintMode !== constraintFilter) {
          return false;
        }

        // Tone filter
        if (toneFilter !== "all" && brief.tone !== toneFilter) {
          return false;
        }

        // Category filter
        if (categoryFilter !== "all" && brief.category !== categoryFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return b.timestamp - a.timestamp;
          case "oldest":
            return a.timestamp - b.timestamp;
          case "shortest":
            return a.wordCount - b.wordCount;
          case "longest":
            return b.wordCount - a.wordCount;
          case "title":
            return a.title.localeCompare(b.title);
          case "favorites":
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            return b.timestamp - a.timestamp;
          default:
            return b.timestamp - a.timestamp;
        }
      });
  }, [briefs, searchQuery, favoritesOnly, constraintFilter, toneFilter, categoryFilter, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = briefs.length;
    const favoriteCount = briefs.filter((b) => b.isFavorite).length;
    const totalWords = briefs.reduce((acc, b) => acc + (b.wordCount || 0), 0);
    const avgWords = totalCount > 0 ? Math.round(totalWords / totalCount) : 0;

    // Mode frequencies
    const modeCounts: Record<string, number> = {};
    briefs.forEach((b) => {
      modeCounts[b.constraintMode] = (modeCounts[b.constraintMode] || 0) + 1;
    });

    let mostUsedMode = "twitter_brevity";
    let maxModeCount = 0;
    Object.entries(modeCounts).forEach(([mode, cnt]) => {
      if (cnt > maxModeCount) {
        maxModeCount = cnt;
        mostUsedMode = mode;
      }
    });

    // Categories
    const categories = Array.from(new Set(briefs.map((b) => b.category).filter(Boolean))) as string[];

    return {
      totalCount,
      favoriteCount,
      avgWords,
      mostUsedMode,
      categories,
    };
  }, [briefs]);

  // Mutations
  const addOrUpdateBrief = useCallback(
    (item: Omit<AppBriefRecord, "id" | "timestamp"> & { id?: string; timestamp?: number }) => {
      const saved = saveAppBrief(item);
      setBriefs(getStoredAppBriefs());
      return saved;
    },
    []
  );

  const addBulkBriefs = useCallback(
    (items: Array<Omit<AppBriefRecord, "id" | "timestamp"> & { id?: string; timestamp?: number }>) => {
      const saved = bulkSaveAppBriefs(items);
      setBriefs(getStoredAppBriefs());
      return saved;
    },
    []
  );

  const removeBrief = useCallback((id: string) => {
    const ok = deleteAppBrief(id);
    if (ok) {
      setBriefs(getStoredAppBriefs());
      toast.success("Brief removed from history");
    }
    return ok;
  }, []);

  const clearAll = useCallback((restoreBaseline = false) => {
    clearAppBriefsHistory(restoreBaseline);
    setBriefs(getStoredAppBriefs());
    toast.success(restoreBaseline ? "Reset history to baseline starter briefs" : "Cleared all briefs history");
  }, []);

  const toggleFav = useCallback((id: string) => {
    const isFav = toggleBriefFavorite(id);
    setBriefs(getStoredAppBriefs());
    toast.success(isFav ? "Added to favorites ⭐" : "Removed from favorites");
    return isFav;
  }, []);

  const markApplied = useCallback((id: string) => {
    setBriefActiveApplied(id);
    setBriefs(getStoredAppBriefs());
  }, []);

  const rate = useCallback((id: string, rating: number) => {
    setBriefRating(id, rating);
    setBriefs(getStoredAppBriefs());
  }, []);

  const exportJSON = useCallback(() => {
    exportBriefsToJSON(filteredBriefs);
    toast.success(`Exported ${filteredBriefs.length} briefs to JSON!`);
  }, [filteredBriefs]);

  const exportCSV = useCallback(() => {
    exportBriefsToCSV(filteredBriefs);
    toast.success(`Exported ${filteredBriefs.length} briefs to CSV!`);
  }, [filteredBriefs]);

  const exportMD = useCallback(() => {
    exportBriefsToMarkdown(filteredBriefs);
    toast.success(`Exported ${filteredBriefs.length} briefs to Markdown!`);
  }, [filteredBriefs]);

  const importJSON = useCallback((jsonStr: string) => {
    const res = importBriefsFromJSON(jsonStr);
    if (res.success) {
      setBriefs(getStoredAppBriefs());
      toast.success(`Imported ${res.count} briefs successfully!`);
    } else {
      toast.error(res.error || "Import failed");
    }
    return res;
  }, []);

  return {
    briefs,
    filteredBriefs,
    stats,
    searchQuery,
    setSearchQuery,
    constraintFilter,
    setConstraintFilter,
    toneFilter,
    setToneFilter,
    categoryFilter,
    setCategoryFilter,
    favoritesOnly,
    setFavoritesOnly,
    sortBy,
    setSortBy,
    addOrUpdateBrief,
    addBulkBriefs,
    removeBrief,
    clearAll,
    toggleFav,
    markApplied,
    rate,
    exportJSON,
    exportCSV,
    exportMD,
    importJSON,
  };
}
