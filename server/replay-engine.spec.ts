import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplayEngine, type ReplayJudge } from "./replay-engine";
import { deviceLocks } from "./device-locks";
import { replayRequestSchema } from "../shared/replay";
import type { ReplayAdapter } from "./replay-adapter";
import { phoneReplayAction } from "./replay-adapter";

const step = {
  id: "step-1",
  name: "Open settings",
  action: "click",
  x: 0,
  y: 0,
  delayMs: 0,
};
const request = { targetDevice: "desktop", steps: [step], confirmation: true };
const frame = (hash = "before") => ({
  image: "data:image/png;base64,aGVsbG8=",
  hash,
  width: 100,
  height: 200,
  capturedAt: Date.now(),
});
function fixture(judgeOverride?: ReplayJudge) {
  let executed = false;
  const adapter: ReplayAdapter = {
    capture: vi.fn(async () => frame(executed ? "after" : "before")),
    execute: vi.fn(async () => {
      executed = true;
    }),
  };
  const judge = vi.fn(
    judgeOverride ||
      (async (phase) => ({
        certain: true,
        explanation: phase,
        x: 0,
        y: 0,
        verified: phase === "verification",
      })),
  );
  return { adapter, judge, engine: new ReplayEngine(() => adapter, judge) };
}
async function finished(engine: ReplayEngine, id: string) {
  await vi.waitFor(
    () =>
      expect(["completed", "failed", "cancelled"]).toContain(
        engine.get(id)?.status,
      ),
    { timeout: 3000, interval: 10 },
  );
  return engine.get(id)!;
}
afterEach(() => {
  deviceLocks.release("desktop");
});
describe("verified replay", () => {
  it("uses before and fresh after evidence, preserves zero coordinates, and confirms only after review", async () => {
    const { engine, adapter, judge } = fixture();
    const run = await finished(engine, engine.start(request).id);
    expect(run.status).toBe("completed");
    expect(run.completed).toBe(1);
    expect(adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0 }),
      expect.objectContaining({ hash: "before" }),
    );
    expect(judge).toHaveBeenLastCalledWith(
      "verification",
      expect.anything(),
      expect.objectContaining({ hash: "before" }),
      expect.objectContaining({ hash: "after" }),
    );
    expect(run.events.some((e) => e.afterHash === "after")).toBe(true);
  });
  it("retries uncertain target detection before executing and records the correction", async () => {
    let attempts = 0;
    const { engine, adapter } = fixture(async (phase) => ({
      certain: phase === "verification" || ++attempts > 1,
      explanation: "target check",
      x: 12,
      y: 25,
      verified: phase === "verification",
    }));
    const run = await finished(engine, engine.start(request).id);
    expect(run.status).toBe("completed");
    expect(adapter.execute).toHaveBeenCalledTimes(1);
    expect(adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ x: 12, y: 25 }),
      expect.anything(),
    );
    expect(run.events.filter((e) => e.phase === "recovery")).toHaveLength(1);
  });
  it("stops uncertain outcomes without repeating a potentially completed action", async () => {
    const { engine, adapter } = fixture(async () => ({
      certain: true,
      explanation: "No visible result",
      x: 0,
      y: 0,
      verified: false,
    }));
    const run = await finished(
      engine,
      engine.start({ ...request, steps: [step, { ...step, id: "step-2" }] }).id,
    );
    expect(run.status).toBe("failed");
    expect(run.completed).toBe(0);
    expect(adapter.execute).toHaveBeenCalledTimes(1);
    expect(run.steps[1].status).toBe("pending");
  });
  it("never dispatches when the screen changes during both planning attempts", async () => {
    const { engine, adapter } = fixture();
    let captures = 0;
    adapter.capture = vi.fn(async () => frame(String(++captures)));
    const run = await finished(engine, engine.start(request).id);
    expect(run.status).toBe("failed");
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(captures).toBe(4);
  });
  it("cancellation during planning prevents subsequent device execution", async () => {
    let release!: (value: any) => void;
    const { engine, adapter } = fixture(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const run = engine.start(request);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    engine.control(run.id, "cancel");
    release({ certain: true, explanation: "target", x: 0, y: 0 });
    expect((await finished(engine, run.id)).status).toBe("cancelled");
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(engine.busy("desktop")).toBe(false);
  });
  it("holds a device lock and supports breakpoint resume", async () => {
    const { engine, adapter } = fixture();
    const run = engine.start({
      ...request,
      steps: [{ ...step, breakpoint: true }],
    });
    expect(engine.get(run.id)?.status).toBe("paused");
    expect(() => engine.start(request)).toThrow("active replay");
    expect(adapter.execute).not.toHaveBeenCalled();
    engine.control(run.id, "resume");
    expect((await finished(engine, run.id)).status).toBe("completed");
  });
  it("rejects stale frames and real execution failures without simulated success", async () => {
    const { engine, adapter } = fixture();
    adapter.capture = vi.fn(async () => ({
      ...frame(),
      capturedAt: Date.now() - 6000,
    }));
    expect((await finished(engine, engine.start(request).id)).error).toContain(
      "stale",
    );
    expect(adapter.execute).not.toHaveBeenCalled();
    adapter.capture = vi.fn(async () => frame());
    adapter.execute = vi.fn(async () => {
      throw new Error("Device disconnected");
    });
    const failed = await finished(engine, engine.start(request).id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("Device disconnected");
  });
  it("does not accept reused native frame timestamps as post-action evidence", async () => {
    const { engine, adapter } = fixture();
    const initial = frame();
    adapter.capture = vi.fn(async () => initial);
    const run = await finished(engine, engine.start(request).id);
    expect(run.error).toContain("new screenshot");
    expect(run.completed).toBe(0);
  });
  it("fails when the AI response is invalid and preserves immutable run snapshots", async () => {
    const { engine, adapter } = fixture(
      async () => ({ certain: "yes", explanation: "bad" }) as any,
    );
    const run = engine.start(request);
    run.steps.length = 0;
    expect((await finished(engine, run.id)).steps).toHaveLength(1);
    expect(engine.get(run.id)?.status).toBe("failed");
    expect(adapter.execute).not.toHaveBeenCalled();
  });
  it("validates action budgets, device selection, unique IDs and unsupported branches", () => {
    for (const bad of [
      { ...request, confirmation: false },
      { ...request, iterations: 9999 },
      { ...request, targetDevice: "android" },
      { ...request, steps: [step, step] },
      { ...request, steps: [{ ...step, conditionType: "ocr_contains" }] },
      {
        ...request,
        iterations: 25,
        steps: Array.from({ length: 5 }, (_, i) => ({
          ...step,
          id: String(i),
        })),
      },
    ])
      expect(replayRequestSchema.safeParse(bad).success).toBe(false);
  });
  it("maps Android coordinates using its actual screenshot dimensions and rejects unsupported actions", () => {
    expect(phoneReplayAction(step as any, frame())).toEqual({
      type: "tap",
      x: 0,
      y: 0,
    });
    expect(
      phoneReplayAction({ ...step, x: 99, y: 199 } as any, frame()),
    ).toEqual({ type: "tap", x: 1, y: 1 });
    expect(() =>
      phoneReplayAction({ ...step, action: "hotkey" } as any, frame()),
    ).toThrow("does not support");
  });
});
