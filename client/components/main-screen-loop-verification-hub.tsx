import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReplayRun } from "@shared/replay";
export function MainScreenLoopVerificationHub({
  onRunAutonomousLoop,
  onStop,
  run,
}: {
  onRunAutonomousLoop?: (
    iterations: number,
    requireUserClarification: boolean,
  ) => void;
  onStop?: () => void;
  run?: ReplayRun | null;
}) {
  const [iterations, setIterations] = useState(1);
  const active = run?.status === "running" || run?.status === "paused";
  return (
    <section className="rounded-lg border border-purple-800 bg-slate-950 p-4 space-y-3">
      <h3 className="font-semibold text-purple-200">Verified replay loop</h3>
      <p className="text-sm text-slate-400">
        Each iteration repeats the recorded actions on the selected device.
        Uncertain outcomes stop the run for review.
      </p>
      <label className="text-sm flex gap-3 items-center">
        Iterations (1–25)
        <input
          type="number"
          min={1}
          max={25}
          value={iterations}
          disabled={active}
          className="w-20 bg-slate-900 border rounded p-1"
          onChange={(e) => setIterations(Number(e.target.value))}
        />
      </label>
      <Button
        size="sm"
        disabled={
          !active &&
          (!Number.isInteger(iterations) || iterations < 1 || iterations > 25)
        }
        onClick={() =>
          active ? onStop?.() : onRunAutonomousLoop?.(iterations, true)
        }
      >
        {active ? "Stop loop" : "Run verified loop"}
      </Button>
      <p className="text-xs" role="status">
        {run
          ? `${run.status}: ${run.completed}/${run.total} actions verified`
          : "No replay has run. Maximum 100 actions and 15 minutes per run."}
      </p>
    </section>
  );
}
