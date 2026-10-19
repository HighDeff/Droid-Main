import { useMemo, useState } from "react";
import { Pause, Play, Clock, Layers, Activity } from "lucide-react";
import type { ReplayEvent, ReplayRun } from "@shared/replay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabContextualSettingsBar } from "./tab-contextual-settings-bar";

interface MasterWorkflowOrchestratorProps {
  run: ReplayRun | null;
  stepCount: number;
  onRun: (iterations: number) => void;
  onControl: (command: "pause" | "resume" | "cancel") => Promise<void>;
  onReset: () => void;
}

const stageDefinitions = [
  { id: 1, name: "Capture current screen", description: "Capture fresh screenshot evidence from the selected device." },
  { id: 2, name: "AI perception & planning", description: "Locate the approved target using the current screenshot and reference frame." },
  { id: 3, name: "Execute approved action", description: "Send the selected action to the active desktop or Android device." },
  { id: 4, name: "Recover uncertain targets", description: "Re-inspect after uncertainty; never repeat an unverified action blindly." },
  { id: 5, name: "Verify screen outcome", description: "Compare fresh before/after screenshots using the configured vision model." },
  { id: 6, name: "Commit verified step", description: "Mark a step complete only after screenshot-based verification." },
  { id: 7, name: "Complete or continue", description: "Continue remaining steps or finish the requested replay iterations." },
];
const phaseStage: Record<ReplayEvent["phase"], number> = {
  perception: 1,
  planning: 2,
  execution: 3,
  recovery: 4,
  verification: 5,
  system: 7,
};

export const MasterWorkflowOrchestrator = ({ run, stepCount, onRun, onControl, onReset }: MasterWorkflowOrchestratorProps) => {
  const [iterationLimit, setIterationLimit] = useState(1);
  const iterationMax = Math.max(1, Math.min(25, Math.floor(100 / Math.max(stepCount, 1))));
  const effectiveIterations = Math.min(iterationLimit, iterationMax);
  const active = run?.status === "running" || run?.status === "paused";
  const latestOperationalEvent = [...(run?.events || [])].reverse().find((event) => event.phase !== "system");
  const currentStage = run?.status === "completed" ? 7 : latestOperationalEvent ? phaseStage[latestOperationalEvent.phase] : 1;
  const elapsedSeconds = run ? Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000)) : 0;
  const logEntries = useMemo(() => [...(run?.events || [])].reverse().slice(0, 50), [run?.events]);

  const handleToggle = () => {
    if (run?.status === "running") void onControl("pause");
    else if (run?.status === "paused") void onControl("resume");
    else onRun(effectiveIterations);
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <div className="space-y-4 font-mono">
      <TabContextualSettingsBar
        tabType="pipeline"
        title="Verified Multi-Stage Replay & AI Review"
        badge={run ? run.status.toUpperCase() : "IDLE"}
        settings={[{
          id: "iterations",
          label: "Replay iterations",
          type: "slider",
          value: effectiveIterations,
          min: 1,
          max: iterationMax,
          step: 1,
          unit: "runs",
          description: "Applies to the next verified replay",
        }]}
        onSettingChange={(id, value) => { if (id === "iterations") setIterationLimit(value); }}
        quickActions={[
          { label: run?.status === "running" ? "Pause Master Cycle" : run?.status === "paused" ? "Resume Master Cycle" : "Start Master Cycle ⚡", action: handleToggle, variant: "default" },
          { label: "Reset All Stages", action: handleReset, variant: "secondary" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-cyan-500/40 shadow-xl">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-cyan-400">Replay progress</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <strong className="text-slate-100">{run ? `${run.completed} / ${run.total} actions` : "No replay started"}</strong>
            <Progress value={run?.total ? (run.completed / run.total) * 100 : 0} className="h-1.5 bg-slate-800" />
            {run && <p className="text-slate-400">Iteration {run.iteration} · {run.target}</p>}
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-emerald-500/40 shadow-xl">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-emerald-400 flex items-center gap-1.5"><Clock className="w-4 h-4" />Elapsed time</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs"><strong className="text-emerald-300">{Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s</strong><p className="text-slate-400">Measured from replay start</p></CardContent>
        </Card>
        <Card className="bg-slate-900 border-amber-500/40 shadow-xl">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-amber-400">Latest verified evidence</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs"><strong className="text-slate-100 truncate block">{run?.events.at(-1)?.detail || "No replay evidence yet"}</strong><p className="text-slate-400">{run?.events.at(-1)?.phase || "Waiting for replay"}</p></CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="pb-2 bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold text-slate-100 flex items-center gap-2"><Layers className="w-4 h-4 text-cyan-400" />Seven-stage verified workflow</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={run?.status === "failed" ? "bg-red-950 text-red-300 border-red-800" : "bg-slate-800 text-slate-300 border-slate-700"}>{run?.status || "idle"}</Badge>
            {active && <Button size="sm" variant="destructive" onClick={() => void onControl("cancel")} className="h-7 text-xs">Stop replay</Button>}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          {stageDefinitions.map((stage) => {
            const stageEvents = (run?.events || []).filter((event) => phaseStage[event.phase] === stage.id);
            const isCurrent = active && stage.id === currentStage;
            const isDone = run?.status === "completed" || stageEvents.some((event) => event.phase === "verification") && stage.id < currentStage;
            const failed = run?.status === "failed" && isCurrent;
            const detail = stageEvents.at(-1)?.detail;
            return (
              <div key={stage.id} className={`p-3 rounded-xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${isCurrent ? "bg-slate-950 border-cyan-500 ring-2 ring-cyan-500/30" : isDone ? "bg-slate-950/70 border-emerald-900/60" : "bg-slate-950/40 border-slate-800"}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={failed ? "text-red-300 border-red-700" : isDone ? "text-emerald-300 border-emerald-800" : isCurrent ? "text-cyan-300 border-cyan-500" : "text-slate-400 border-slate-800"}>
                      {failed ? "failed" : isDone ? "verified" : isCurrent ? run?.status === "paused" ? "paused" : "active" : run ? "pending" : "idle"}
                    </Badge>
                    <span className="font-bold text-slate-100">{stage.id}. {stage.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-300">{detail || stage.description}</p>
                </div>
                <span className="text-[10px] text-slate-400">{stageEvents.length} evidence event(s)</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="pb-2 bg-slate-950 border-b border-slate-800"><CardTitle className="text-xs font-bold text-cyan-400 flex items-center gap-2"><Activity className="w-4 h-4" />Replay AI decision & evidence feed</CardTitle></CardHeader>
        <CardContent className="p-3">
          <ScrollArea className="h-44 pr-2">
            {!logEntries.length ? <p className="text-xs text-slate-500">Start a replay to see real perception, planning, execution, and verification events.</p> : <div className="space-y-2">
              {logEntries.map((event) => (
                <div key={event.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0"><div className="flex gap-2 items-center"><span className="text-[10px] text-slate-400">{new Date(event.at).toLocaleTimeString()}</span><Badge className="bg-cyan-950 text-cyan-300 border-cyan-800 text-[9px] uppercase">{event.phase}</Badge>{event.stepId && <span className="text-slate-400">{event.stepId}</span>}</div><p className="text-slate-200 mt-1">{event.detail}</p></div>
                  <div className="flex shrink-0 gap-1">{event.beforeHash && <span className="text-[9px] text-slate-500" title="Before screenshot hash">B:{event.beforeHash.slice(0, 8)}</span>}{event.afterHash && <span className="text-[9px] text-emerald-400" title="After screenshot hash">A:{event.afterHash.slice(0, 8)}</span>}</div>
                </div>
              ))}
            </div>}
          </ScrollArea>
        </CardContent>
      </Card>
      {run?.error && <p role="alert" className="text-xs text-red-300">Replay error: {run.error}</p>}
    </div>
  );
};
