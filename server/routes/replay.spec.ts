import {
  handleDescribeScreen,
  handleAutoCalibrateWorkflow,
} from "./dual-ai-pipeline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { replayRouter } from "./replay";
import { requireApiAccess } from "../security";
import { assistantExecutionRouter } from "./assistant-execution";
import { handleExecuteTask } from "./execute-task";
import { deviceLocks } from "../device-locks";

describe("replay API boundaries", () => {
  let server: Server, base: string;
  beforeEach(async () => {
    vi.stubEnv("ASSISTANT_API_KEY", "fixture-key");
    const app = express();
    app.use(express.json());
    app.use("/api/replay", requireApiAccess, replayRouter);
    app.use(
      "/api/assistant/execution",
      requireApiAccess,
      assistantExecutionRouter,
    );
    app.post("/api/execute-task", requireApiAccess, handleExecuteTask);
    app.post("/api/describe", handleDescribeScreen);
    app.post("/api/calibrate", handleAutoCalibrateWorkflow);
    app.post("/fixture/api/chat", (_req, res) =>
      res.status(503).json({ error: "fixture provider offline" }),
    );
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterEach(async () => {
    deviceLocks.clear();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
  });
  const post = (url: string, body: unknown, authenticated = true) =>
    fetch(base + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { "x-api-key": "fixture-key" } : {}),
      },
      body: JSON.stringify(body),
    });
  it("protects starts, status, screenshots and controls", async () => {
    expect((await post("/api/replay", {}, false)).status).toBe(401);
    expect((await fetch(base + "/api/replay/id")).status).toBe(401);
    expect((await fetch(base + "/api/replay/id/frames/hash")).status).toBe(401);
    expect((await post("/api/replay/id/cancel", {}, false)).status).toBe(401);
  });
  it("validates confirmation and rejects missing or unsupported requests", async () => {
    expect((await post("/api/replay", {})).status).toBe(400);
    expect((await post("/api/replay/id/unknown", {})).status).toBe(400);
    expect((await post("/api/replay/id/cancel", {})).status).toBe(404);
  });
  it("registers uncertain-analysis approval independently of alternate approval", async () => {
    const response = await post("/api/assistant/execution/unknown/approve", {});
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Explicit confirmation");
    const confirmed = await post("/api/assistant/execution/unknown/approve", {
      confirmation: true,
    });
    expect(confirmed.status).toBe(404);
    expect((await confirmed.json()).error).toBe("Execution not found");
  });
  it("fails honestly when Python cannot start and never falls through to simulated execution", async () => {
    vi.stubEnv("PYTHON_CMD", "/nonexistent/droid-test-python");
    const response = await post("/api/execute-task", {
      task: { id: "test", name: "Click", action: "click", x: 0, y: 0 },
    });
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.simulated).toBeUndefined();
    expect(deviceLocks.has("desktop")).toBe(false);
  });
  it("prevents a manual action from racing with replay on the same device", async () => {
    deviceLocks.add("desktop");
    const response = await post("/api/execute-task", {
      task: { action: "click", x: 0, y: 0 },
    });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("busy");
  });
  it("never invents a perception report or drift when evidence is unavailable", async () => {
    const response = await post("/api/describe", {
      imageData: "data:image/png;base64,aGVsbG8=",
      endpoint: base + "/fixture/api/chat",
    });
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.report).toBeUndefined();
    expect(
      (
        await post("/api/calibrate", {
          steps: [{ id: "step", x: 0, y: 0 }],
          elements: [],
        })
      ).status,
    ).toBe(422);
  });
});
