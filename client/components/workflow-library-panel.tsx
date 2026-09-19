import { useState, useMemo } from "react";
import { Bookmark, CalendarClock, RefreshCw, ShieldCheck, ArrowUpDown } from "lucide-react";
import type { AssistantWorkflow } from "@shared/assistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type SortOption = "modifiedTime" | "name" | "status" | "repeatCount";

export function WorkflowLibraryPanel() {
  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem("assistant_session_id") ?? "",
  );
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem("workflow_sort_preference");
    return (saved as SortOption) || "modifiedTime";
  });
  const [workflows, setWorkflows] = useState<AssistantWorkflow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem("workflow_sort_preference", newSort);
  };

  const sortedWorkflows = useMemo(() => {
    return [...workflows].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      if (sortBy === "repeatCount") {
        return (b.repeatCount || 0) - (a.repeatCount || 0);
      }
      // default: modifiedTime / nextRunAt
      const timeA = a.schedule?.nextRunAt ? new Date(a.schedule.nextRunAt).getTime() : 0;
      const timeB = b.schedule?.nextRunAt ? new Date(b.schedule.nextRunAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [workflows, sortBy]);

  const loadWorkflows = async () => {
    setError("");
    setLoading(true);
    try {
      localStorage.setItem("assistant_session_id", sessionId);
      const response = await fetch(
        `/api/assistant/workflows?sessionId=${encodeURIComponent(sessionId)}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to load workflows");
      setWorkflows(data.workflows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load workflows",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-950/70 text-slate-100">
      <CardHeader>
        <CardTitle>Workflow library</CardTitle>
        <CardDescription className="text-slate-400">
          Saved operation packs, checkpoints, schedules, and progress. Execution
          is intentionally disabled.
        </CardDescription>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-1 gap-2 min-w-[240px]">
            <Input
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              placeholder="Assistant session ID"
              aria-label="Assistant session ID"
              className="border-slate-700 bg-slate-900"
            />
            <Button onClick={loadWorkflows} disabled={!sessionId || loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Load
            </Button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="bg-transparent text-cyan-300 font-bold outline-none cursor-pointer"
            >
              <option value="modifiedTime" className="bg-slate-950 text-slate-200">Date Modified</option>
              <option value="name" className="bg-slate-950 text-slate-200">Name (A-Z)</option>
              <option value="status" className="bg-slate-950 text-slate-200">Status</option>
              <option value="repeatCount" className="bg-slate-950 text-slate-200">Repeat Count</option>
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {!workflows.length && !error && (
          <p className="text-sm text-slate-400">
            Enter a session ID to view its saved workflows.
          </p>
        )}
        {sortedWorkflows.map((workflow) => (
          <div
            key={workflow.id}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{workflow.name}</h3>
                <p className="text-sm text-slate-400">
                  {workflow.description || "No description"}
                </p>
              </div>
              <Badge
                variant={workflow.status === "paused" ? "secondary" : "default"}
              >
                {workflow.status}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <span>Repeat count: {workflow.repeatCount}</span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-4 w-4" />
                Next run:{" "}
                {workflow.schedule.nextRunAt
                  ? new Date(workflow.schedule.nextRunAt).toLocaleString()
                  : "Not scheduled"}
              </span>
              <span className="flex items-center gap-1">
                <Bookmark className="h-4 w-4" />
                Checkpoints: {workflow.checkpointIds.length}
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                Resume: {workflow.pauseResumePolicy.resumeMode}
              </span>
            </div>
            {workflow.goals.map((goal) => {
              const percent = goal.total
                ? (goal.completed / goal.total) * 100
                : 0;
              return (
                <div key={goal.goalId} className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>{goal.title}</span>
                    <span>
                      {goal.completed}/{goal.total}
                    </span>
                  </div>
                  <Progress value={percent} className="h-2" />
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
