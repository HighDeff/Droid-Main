import { describe, expect, it, vi } from "vitest";
import type { ReplayAdapter } from "./replay-adapter";
import { PointerAlignmentError } from "./replay-adapter";
import { ReplayEngine } from "./replay-engine";
import type { ReplayRequest } from "../shared/replay";

describe("replay pointer alignment recovery", () => {
  it("reperceives and replans before the only retry when preflight refuses a target", async () => {
    const frame = {
      image: "data:image/png;base64,aGVsbG8=",
      width: 100,
      height: 80,
      hash: "stable-frame",
      capturedAt: Date.now(),
    };
    const executed: Array<{ x: number; y: number }> = [];
    let executeAttempts = 0;
    const adapter: ReplayAdapter = {
      capture: async () => ({ ...frame, capturedAt: Date.now() }),
      execute: async (step) => {
        if (executeAttempts++ === 0) throw new PointerAlignmentError("Alignment failed", { aligned: false, driftPx: 6 });
        executed.push({ x: step.x, y: step.y });
      },
    };
    const judge = vi.fn(async (phase: "planning" | "verification") => phase === "verification"
      ? { certain: true, verified: true, explanation: "Expected screen result is visible." }
      : { certain: true, x: 40, y: 30, explanation: "Target is visible at the fresh screenshot position." });
    const engine = new ReplayEngine(() => adapter, judge);
    const request: ReplayRequest = {
      targetDevice: "desktop",
      steps: [{ id: "step-1", name: "Open menu", action: "click", x: 20, y: 15, delayMs: 0 }],
      iterations: 1,
      confirmation: true,
    };

    const run = engine.start(request, adapter);
    await vi.waitFor(() => expect(engine.get(run.id)?.status).toBe("completed"));

    expect(executed).toEqual([{ x: 40, y: 30 }]);
    expect(judge.mock.calls.filter(([phase]) => phase === "planning")).toHaveLength(2);
    expect(engine.get(run.id)?.events.some((event) => event.detail.includes("fresh screenshot"))).toBe(true);
  });
});
