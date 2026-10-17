import { useState, useEffect, useCallback } from "react";
import { getAppBriefs, AppBriefRecord } from "@/lib/app-brief-history-store";

export function useAppBriefHistory() {
  const [briefs, setBriefs] = useState<AppBriefRecord[]>([]);

  const refresh = useCallback(() => {
    setBriefs(getAppBriefs());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalWords = briefs.reduce((acc, b) => acc + (b.wordCount || 0), 0);
  const avgWords = briefs.length ? Math.round(totalWords / briefs.length) : 0;
  const categories = new Set(briefs.map((b) => b.category || "Pitch"));

  const stats = {
    totalBriefs: briefs.length,
    totalWords,
    avgWords,
    categoriesCount: categories.size,
  };

  return { briefs, stats, refresh };
}
