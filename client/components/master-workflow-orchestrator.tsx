import type { ReplayRun } from "@shared/replay";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function MasterWorkflowOrchestrator({ run, onRun, onControl }: {
  run: ReplayRun | null;
  onRun: () => void;
  onControl: (command: "pause" | "resume" | "cancel") => void;
}) {
  const active = run?.status === "running" || run?.status === "paused";
  const event = run?.events.at(-1);
  return <section className="border border-cyan-800 rounded-lg p-4 bg-slate-950 space-y-3" aria-label="Workflow controller">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold text-cyan-200">Screenshot-guided workflow controller</h2>
      <div className="flex gap-2">
        {active ? <>
          <Button size="sm" onClick={() => onControl(run.status === "paused" ? "resume" : "pause")}>{run.status === "paused" ? "Resume" : "Pause"}</Button>
          <Button size="sm" variant="destructive" onClick={() => onControl("cancel")}>Stop</Button>
        </> : <Button size="sm" onClick={onRun}>Run recorded workflow</Button>}
      </div>
    </div>
    <p className="text-sm text-slate-400">Capture → locate target → check current screen → execute → review outcome → confirm. Target detection retries are bounded; uncertain effects stop for review.</p>
    <Progress value={run?.total ? run.completed / run.total * 100 : 0} />
    <p role="status" className="text-sm">{run ? `${run.target}: ${run.status} · ${run.completed}/${run.total} actions verified` : "No workflow has run"}</p>
    {event && <p className="text-xs text-slate-300">{event.phase}: {event.detail}</p>}
    {run?.error && <p role="alert" className="text-sm text-amber-300">{run.error}</p>}
    <p className="text-xs text-slate-500">See the Replay agent monitor below for screenshot evidence and decision summaries.</p>
  </section>;
}
